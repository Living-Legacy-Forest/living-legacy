import {
  type InternalResult,
  internalManageSchema,
  publicBookingSchema,
  safeEqual,
} from '@ll/content';
import { createDb } from '@ll/db';
import * as Sentry from '@sentry/cloudflare';
import { confirmBooking } from './booking-confirmations';
import { bookFromWebsite, cancelFromWebsite, viewBooking } from './public-bookings';

const NOT_FOUND = 'We could not find that booking. Check the link in your confirmation email.';

function json(body: InternalResult<Record<string, unknown>>, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

const fail = (status: number, message: string) => json({ ok: false, message }, status);

/**
 * The calls the website makes over its service binding, behind a shared key: book, view and
 * cancel an event booking. The website holds no booking rules; it passes the visitor's input
 * through and shows the sentence that comes back. Logs say what was wrong with a call, never the
 * key or anything the guest typed.
 */
export async function internalResponse(
  request: Request,
  env: Cloudflare.Env,
  ctx: Pick<ExecutionContext, 'waitUntil'>
): Promise<Response> {
  // Fail closed: without both secrets nothing here can be trusted to run.
  if (!env.INTERNAL_KEY || !env.MANAGE_TOKEN_SECRET) {
    console.error('[internal] INTERNAL_KEY or MANAGE_TOKEN_SECRET is not set.');
    return fail(503, 'This service is not available.');
  }
  const key = request.headers.get('x-internal-key');
  if (!key || !safeEqual(key, env.INTERNAL_KEY)) {
    console.warn('[internal] a call arrived with a missing or wrong key.');
    return fail(401, 'Unauthorised.');
  }

  const route = new URL(request.url).pathname;
  if (
    route !== '/internal/events/book' &&
    route !== '/internal/events/view' &&
    route !== '/internal/events/cancel'
  ) {
    return fail(404, 'Not found.');
  }
  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, message: 'Method not allowed.' },
      { status: 405, headers: { Allow: 'POST' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn(`[internal] ${route} got a body that is not JSON.`);
    return fail(400, 'The request could not be read.');
  }

  try {
    return await dispatch(route, body, env, ctx, env.MANAGE_TOKEN_SECRET);
  } catch (error) {
    // The website expects JSON from every call; without this a store error would reach it as
    // the platform's own error page. Sentry still hears of it, as it would from an escape.
    console.error(`[internal] ${route} failed:`, describeFailure(error));
    Sentry.captureException(error, { tags: { route } });
    return fail(500, 'Something went wrong on our side. Please try again in a moment.');
  }
}

/**
 * What is safe to log about a failure. A failed Drizzle query throws a `DrizzleQueryError` whose
 * message is the SQL plus every bound value (the guest's name, email, phone and note), so its
 * message is never logged: the error's name and the database's own reason are.
 */
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  if (error.name === 'DrizzleQueryError') return `${error.name}: ${cause ?? 'no reason given'}`;
  return cause ? `${error.message} (${cause})` : error.message;
}

async function dispatch(
  route: string,
  body: unknown,
  env: Cloudflare.Env,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  secret: string
): Promise<Response> {
  const db = createDb(env.DB);

  if (route === '/internal/events/book') {
    const parsed = publicBookingSchema.safeParse(body);
    if (!parsed.success) return invalid(route, parsed.error);
    const result = await bookFromWebsite(db, parsed.data, secret);
    if (!result.ok) return json(result, 409);

    // The visitor should not wait for the email. Deps are built inside, and nothing from it
    // escapes: a failed confirmation is retried by the cron job and never touches the booking.
    ctx.waitUntil(
      (async () => {
        try {
          await confirmBooking(db, result.id);
        } catch (error) {
          console.error(
            '[internal] a booking confirmation could not be queued:',
            describeFailure(error)
          );
        }
      })()
    );
    return json({ ok: true, reference: result.reference, token: result.token }, 200);
  }

  const parsed = internalManageSchema.safeParse(body);
  if (!parsed.success) return invalid(route, parsed.error);
  const { reference, token } = parsed.data;

  const booking =
    route === '/internal/events/view'
      ? await viewBooking(db, reference, token)
      : await cancelFromWebsite(db, reference, token);
  return booking ? json({ ok: true, booking }, 200) : fail(404, NOT_FOUND);
}

function invalid(route: string, error: { issues: { message: string; path: PropertyKey[] }[] }) {
  // Field names only: the values are the guest's own details.
  console.warn(
    `[internal] ${route} got an invalid body (${error.issues.map((i) => i.path.join('.')).join(', ')}).`
  );
  return fail(400, error.issues[0]?.message ?? 'The request could not be read.');
}

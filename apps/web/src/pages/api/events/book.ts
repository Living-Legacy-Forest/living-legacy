import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { publicBookingSchema } from '@ll/content';

import { callCms } from '@/lib/cms-internal';

export const prerender = false;

/** The slice of the rate limiting binding used here; absent in local dev. */
interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

function json(body: { ok: false; message: string } | object, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

const fail = (message: string, status: number) => json({ ok: false, message }, status);

/**
 * Takes a booking from the event page's form and hands it to the CMS, which holds
 * the rules (places left, closing time) and sends the confirmation. Nothing about
 * the guest is logged here.
 */
export const POST: APIRoute = async ({ request }) => {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return fail('Something went wrong with that form. Please try again.', 400);
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return fail('Something went wrong with that form. Please try again.', 400);
  }

  // Honeypot: a hidden field people never fill in. Bots get the same plain refusal.
  const { company, ...fields } = input as Record<string, unknown>;
  if (typeof company === 'string' && company.trim() !== '') {
    return fail('Something went wrong with that form. Please try again.', 400);
  }

  // Without the binding (local dev, tests) limiting is skipped rather than refusing.
  const limiter = (env as { BOOKING_LIMITER?: Limiter }).BOOKING_LIMITER;
  if (limiter) {
    const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const { success } = await limiter.limit({ key });
    if (!success) {
      return fail('Too many bookings from here in a minute. Wait a moment and try again.', 429);
    }
  }

  const parsed = publicBookingSchema.safeParse(fields);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Check the form and try again.', 400);
  }

  try {
    const { status, data } = await callCms('/internal/events/book', parsed.data);
    return json(data, status);
  } catch (error) {
    // Only a reason: the key and the guest's details never reach the logs.
    console.error('[booking] CMS call failed:', error instanceof Error ? error.name : 'unknown');
    return fail('We could not take your booking just now. Please try again, or call us.', 502);
  }
};

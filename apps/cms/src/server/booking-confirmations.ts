import { hashManageToken, manageToken, manageUrl, safeEqual } from '@ll/content';
import type { Db } from '@ll/db';
import { eventBookings, events } from '@ll/db/schema';
import { and, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { describeFailure } from '@/lib/describe-failure';
import { type BookingConfirmation, cmsOrigin, sendBookingConfirmationEmail } from '@/lib/email';
import { readSiteSettings } from '@/lib/site-settings';

/** How long an unsent confirmation is retried. After this the guest has the thank-you page. */
const RETRY_WINDOW_MS = 24 * 3_600_000;
/** The first email is sent as the booking is made; the retry waits so it cannot send a second copy mid-send. */
const RETRY_GRACE_MS = 2 * 60_000;
/** Per run, so one bad day of failures cannot make a single cron run send hundreds of emails. */
const RETRY_BATCH = 50;

export type ConfirmDeps = {
  send: (to: string, c: BookingConfirmation) => Promise<void>;
  secret: string;
  websiteOrigin: string;
  cmsOrigin: string;
  enabled: () => Promise<boolean>;
};

/** Read from env when called, never at import, so tests and tooling can load this file. */
export function confirmDeps(): ConfirmDeps {
  return {
    // Replies go to the bookings email in Settings, when there is one.
    send: async (to, c) =>
      sendBookingConfirmationEmail(to, c, (await readSiteSettings()).bookingsEmail || undefined),
    secret: env.MANAGE_TOKEN_SECRET ?? '',
    websiteOrigin: new URL(env.WEBSITE_URL).origin,
    cmsOrigin: cmsOrigin(),
    enabled: async () => (await readSiteSettings()).sendBookingConfirmations,
  };
}

/**
 * Emails a website booking its confirmation, once. A booking is never failed or undone by its
 * email: any problem is logged (never the address) and comes back as 'failed', and the retry job
 * tries again. 'skipped' means there was nothing to send: turned off, already sent, not a
 * website booking, cancelled, or no address.
 */
export async function confirmBooking(
  db: Db,
  bookingId: string,
  deps: ConfirmDeps = confirmDeps(),
  now = new Date()
): Promise<'sent' | 'skipped' | 'failed'> {
  try {
    if (!(await deps.enabled())) return 'skipped';

    const [row] = await db
      .select({ booking: eventBookings, event: events })
      .from(eventBookings)
      .innerJoin(events, eq(eventBookings.eventId, events.id))
      .where(eq(eventBookings.id, bookingId))
      .limit(1);
    if (!row) return 'skipped';
    const { booking, event } = row;
    if (
      booking.status !== 'confirmed' ||
      booking.source !== 'website' ||
      !booking.email ||
      booking.confirmationSentAt
    ) {
      return 'skipped';
    }

    // The link is rebuilt from the secret. If the secret is missing or has changed since the
    // booking, the rebuilt token no longer matches the stored hash, and a dead link must not go out.
    if (!deps.secret) throw new Error('MANAGE_TOKEN_SECRET is not set');
    const token = await manageToken(deps.secret, booking.id);
    if (
      !booking.manageTokenHash ||
      !safeEqual(await hashManageToken(token), booking.manageTokenHash)
    ) {
      throw new Error('The booking link no longer matches the secret');
    }

    await deps.send(booking.email, {
      firstName: booking.firstName,
      reference: booking.reference,
      partySize: booking.partySize,
      title: event.title,
      startsAt: event.startsAt.getTime(),
      endsAt: event.endsAt.getTime(),
      timeZone: event.timeZone as BookingConfirmation['timeZone'],
      venue: event.venue ?? '',
      manageUrl: manageUrl(deps.websiteOrigin, booking.reference, token),
      calendarUrl: `${deps.cmsOrigin}/api/tickets/${booking.reference}/calendar`,
      qrUrl: `${deps.cmsOrigin}/api/tickets/${booking.reference}/qr`,
    });

    await db
      .update(eventBookings)
      .set({ confirmationSentAt: now })
      .where(and(eq(eventBookings.id, booking.id), isNull(eventBookings.confirmationSentAt)));
    return 'sent';
  } catch (error) {
    console.error(`[booking-confirmation] ${bookingId} not sent: ${describeFailure(error)}`);
    return 'failed';
  }
}

/**
 * Tries again for website bookings whose confirmation has not gone, for a day after they were
 * made. Run by the five-minute cron.
 */
export async function retryConfirmations(
  db: Db,
  deps: ConfirmDeps = confirmDeps(),
  now = new Date()
): Promise<{ sent: number; failed: number }> {
  const unsent = await db
    .select({ id: eventBookings.id })
    .from(eventBookings)
    .where(
      and(
        eq(eventBookings.status, 'confirmed'),
        eq(eventBookings.source, 'website'),
        isNotNull(eventBookings.email),
        isNull(eventBookings.confirmationSentAt),
        gte(eventBookings.createdAt, new Date(now.getTime() - RETRY_WINDOW_MS)),
        lt(eventBookings.createdAt, new Date(now.getTime() - RETRY_GRACE_MS))
      )
    )
    .orderBy(eventBookings.createdAt)
    .limit(RETRY_BATCH);

  const result = { sent: 0, failed: 0 };
  for (const { id } of unsent) {
    const outcome = await confirmBooking(db, id, deps, now);
    if (outcome === 'sent') result.sent++;
    else if (outcome === 'failed') result.failed++;
  }
  return result;
}

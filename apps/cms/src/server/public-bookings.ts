import {
  bookingProblem,
  hashManageToken,
  type InternalResult,
  manageToken,
  type ManagedBooking,
  type PublicBookingInput,
  safeEqual,
  seatsTaken,
} from '@ll/content';
import type { Db } from '@ll/db';
import { eventBookings, events } from '@ll/db/schema';
import { and, eq } from 'drizzle-orm';
import { bookable, insertBooking } from './booking-store';

export const DUPLICATE_MESSAGE =
  'You have already booked this event. Use the link in your confirmation email to see or cancel your booking, or call us.';

const NOT_OPEN = 'This event is not open for bookings.';
const FULL = 'This event is fully booked.';

/**
 * Books a place from the website. The rules and the duplicate-email check are reads before the
 * write, so two requests with the same email at the same moment could both pass the duplicate
 * check (accepted); the places themselves cannot be oversold, as `insertBooking` is one statement.
 * The token is derived from the booking id, so it can be rebuilt; only its hash is stored.
 */
export async function bookFromWebsite(
  db: Db,
  input: PublicBookingInput,
  secret: string,
  now = Date.now()
): Promise<InternalResult<{ id: string; reference: string; token: string }>> {
  const event = await db.query.events.findFirst({ where: eq(events.id, input.eventId) });
  if (!event) return { ok: false, message: NOT_OPEN };

  const rows = await db
    .select({
      status: eventBookings.status,
      partySize: eventBookings.partySize,
      email: eventBookings.email,
    })
    .from(eventBookings)
    .where(eq(eventBookings.eventId, event.id));

  const problem = bookingProblem(
    bookable(event),
    input.partySize,
    seatsTaken(rows),
    now,
    'website'
  );
  if (problem) return { ok: false, message: problem };

  if (rows.some((r) => r.status === 'confirmed' && r.email === input.email)) {
    return { ok: false, message: DUPLICATE_MESSAGE };
  }

  // The token is derived from the id, so both are known before the insert and the hash is written
  // with the row: a booking never exists without its link.
  const id = crypto.randomUUID();
  const token = await manageToken(secret, id);
  const booking = await insertBooking(
    db,
    {
      id,
      manageTokenHash: await hashManageToken(token),
      eventId: event.id,
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email,
      phone: input.phone || null,
      partySize: input.partySize,
      note: input.note || null,
      source: 'website',
      consentAt: new Date(now),
    },
    event.capacity
  );
  if (!booking) return { ok: false, message: FULL };

  return { ok: true, id: booking.id, reference: booking.reference, token };
}

/** The booking and its event, if the token is the one for this reference. */
async function findManaged(db: Db, reference: string, token: string) {
  const booking = await db.query.eventBookings.findFirst({
    where: eq(eventBookings.reference, reference),
  });
  // Hash even when there is nothing to compare, so a miss takes about as long as a hit.
  const given = await hashManageToken(token);
  if (!booking?.manageTokenHash || !safeEqual(given, booking.manageTokenHash)) return null;
  const event = await db.query.events.findFirst({ where: eq(events.id, booking.eventId) });
  return event ? { booking, event } : null;
}

const managed = (
  booking: typeof eventBookings.$inferSelect,
  event: typeof events.$inferSelect
): ManagedBooking => ({
  reference: booking.reference,
  status: booking.status,
  firstName: booking.firstName,
  partySize: booking.partySize,
  event: {
    title: event.title,
    slug: event.slug,
    startsAt: event.startsAt.getTime(),
    endsAt: event.endsAt.getTime(),
    timeZone: event.timeZone,
    venue: event.venue ?? '',
  },
});

/** A guest's own booking, or null when the reference and token do not match one. */
export async function viewBooking(
  db: Db,
  reference: string,
  token: string
): Promise<ManagedBooking | null> {
  const found = await findManaged(db, reference, token);
  return found ? managed(found.booking, found.event) : null;
}

/**
 * Cancels a guest's own booking, freeing its places. Marked unsynced so HubSpot hears of it.
 * Cancelling twice is harmless: the first cancellation's time is kept. After the event has
 * started, or once the guest is checked in, the booking is returned unchanged.
 */
export async function cancelFromWebsite(
  db: Db,
  reference: string,
  token: string,
  now = new Date()
): Promise<ManagedBooking | null> {
  const found = await findManaged(db, reference, token);
  if (!found) return null;

  // Too late to cancel once the event has started or the guest has been checked in: leave it be.
  if (now.getTime() >= found.event.startsAt.getTime() || found.booking.checkedInAt) {
    return managed(found.booking, found.event);
  }

  await db
    .update(eventBookings)
    .set({ status: 'cancelled', cancelledAt: now, crmSyncedAt: null })
    .where(and(eq(eventBookings.id, found.booking.id), eq(eventBookings.status, 'confirmed')));

  const after = await db.query.eventBookings.findFirst({
    where: eq(eventBookings.id, found.booking.id),
  });
  return after ? managed(after, found.event) : null;
}

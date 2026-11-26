import { type BookableEvent, bookingReference } from '@ll/content';
import type { Db } from '@ll/db';
import type { events } from '@ll/db/schema';
import { sql } from 'drizzle-orm';

/** An event as the booking rules see it. */
export const bookable = (event: typeof events.$inferSelect): BookableEvent => ({
  status: event.status,
  startsAt: event.startsAt.getTime(),
  endsAt: event.endsAt.getTime(),
  bookingsOpenAt: event.bookingsOpenAt?.getTime() ?? null,
  bookingsCloseAt: event.bookingsCloseAt?.getTime() ?? null,
  capacity: event.capacity,
  maxPartySize: event.maxPartySize,
});

export type NewBooking = {
  eventId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  partySize: number;
  note: string | null;
  source: 'website' | 'staff';
  consentAt: Date | null;
  /** Website bookings choose their id first, so the token derived from it is written with the row. */
  id?: string;
  manageTokenHash?: string;
};

/**
 * Writes a confirmed booking only if the event still has room, in one
 * statement, so two bookings for the last places cannot both succeed.
 * Returns null when there was no room. A clashing reference (unique index)
 * is retried with a new one.
 */
export async function insertBooking(
  db: Db,
  b: NewBooking,
  capacity: number | null
): Promise<{ id: string; reference: string } | null> {
  for (let attempt = 0; ; attempt++) {
    const id = b.id ?? crypto.randomUUID();
    const reference = bookingReference(crypto.getRandomValues(new Uint8Array(6)));
    try {
      const result = await db.run(sql`
        INSERT INTO event_bookings
          (id, event_id, reference, first_name, last_name, email, phone, party_size, note,
           status, source, consent_at, manage_token_hash, created_at)
        SELECT ${id}, ${b.eventId}, ${reference}, ${b.firstName}, ${b.lastName}, ${b.email},
          ${b.phone}, ${b.partySize}, ${b.note}, 'confirmed', ${b.source},
          ${b.consentAt?.getTime() ?? null}, ${b.manageTokenHash ?? null}, ${Date.now()}
        WHERE ${capacity} IS NULL OR (
          SELECT coalesce(sum(party_size), 0) FROM event_bookings
          WHERE event_id = ${b.eventId} AND status = 'confirmed'
        ) + ${b.partySize} <= ${capacity}`);
      return result.meta.changes === 1 ? { id, reference } : null;
    } catch (error) {
      if (attempt < 3 && String(error).includes('event_bookings.reference')) continue;
      throw error;
    }
  }
}

export type BookingDetails = Pick<
  NewBooking,
  'firstName' | 'lastName' | 'email' | 'phone' | 'partySize' | 'note'
>;

/**
 * Changes a confirmed booking's details, in one statement that also checks the
 * event still has room for the new party size (counting everyone but this
 * booking). Marks it unsynced so HubSpot gets the change. Returns false when
 * there was no room, or the booking is no longer confirmed.
 */
export async function updateBookingDetails(
  db: Db,
  id: string,
  eventId: string,
  b: BookingDetails,
  capacity: number | null
): Promise<boolean> {
  const result = await db.run(sql`
    UPDATE event_bookings
    SET first_name = ${b.firstName}, last_name = ${b.lastName}, email = ${b.email},
      phone = ${b.phone}, party_size = ${b.partySize}, note = ${b.note}, crm_synced_at = NULL
    WHERE id = ${id} AND status = 'confirmed' AND (${capacity} IS NULL OR (
      SELECT coalesce(sum(party_size), 0) FROM event_bookings
      WHERE event_id = ${eventId} AND status = 'confirmed' AND id != ${id}
    ) + ${b.partySize} <= ${capacity})`);
  return result.meta.changes === 1;
}

/**
 * Puts a party on the event's waiting list. No place is held and nothing is counted, so there is
 * nothing to race against; a clashing reference is retried with a new one.
 */
export async function insertWaitlisted(
  db: Db,
  b: Omit<NewBooking, 'source' | 'consentAt'>
): Promise<{ id: string; reference: string }> {
  for (let attempt = 0; ; attempt++) {
    const id = crypto.randomUUID();
    const reference = bookingReference(crypto.getRandomValues(new Uint8Array(6)));
    try {
      await db.run(sql`
        INSERT INTO event_bookings
          (id, event_id, reference, first_name, last_name, email, phone, party_size, note,
           status, source, consent_at, created_at)
        VALUES (${id}, ${b.eventId}, ${reference}, ${b.firstName}, ${b.lastName}, ${b.email},
          ${b.phone}, ${b.partySize}, ${b.note}, 'waitlisted', 'staff', NULL, ${Date.now()})`);
      return { id, reference };
    } catch (error) {
      if (attempt < 3 && String(error).includes('event_bookings.reference')) continue;
      throw error;
    }
  }
}

/**
 * Moves a waiting party into the event, in one statement that also checks the places are still
 * there, so it cannot overbook if someone is booked at the same moment. It is dated now: the
 * trend of bookings should show when they got a place, not when they joined the list. Marked
 * unsynced, so HubSpot hears of it as a new booking. Returns false when there was no room, or the
 * booking is no longer waiting.
 */
export async function promoteBooking(
  db: Db,
  id: string,
  eventId: string,
  partySize: number,
  capacity: number | null
): Promise<boolean> {
  const result = await db.run(sql`
    UPDATE event_bookings
    SET status = 'confirmed', created_at = ${Date.now()}, crm_synced_at = NULL
    WHERE id = ${id} AND status = 'waitlisted' AND (${capacity} IS NULL OR (
      SELECT coalesce(sum(party_size), 0) FROM event_bookings
      WHERE event_id = ${eventId} AND status = 'confirmed'
    ) + ${partySize} <= ${capacity})`);
  return result.meta.changes === 1;
}

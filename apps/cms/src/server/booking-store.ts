import { bookingReference } from '@ll/content';
import type { Db } from '@ll/db';
import { sql } from 'drizzle-orm';

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
    const id = crypto.randomUUID();
    const reference = bookingReference(crypto.getRandomValues(new Uint8Array(6)));
    try {
      const result = await db.run(sql`
        INSERT INTO event_bookings
          (id, event_id, reference, first_name, last_name, email, phone, party_size, note,
           status, source, consent_at, created_at)
        SELECT ${id}, ${b.eventId}, ${reference}, ${b.firstName}, ${b.lastName}, ${b.email},
          ${b.phone}, ${b.partySize}, ${b.note}, 'confirmed', ${b.source},
          ${b.consentAt?.getTime() ?? null}, ${Date.now()}
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

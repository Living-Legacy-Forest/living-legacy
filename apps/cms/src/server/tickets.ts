// Bookings looked up by the reference on their ticket: for the public QR code
// and calendar links in HubSpot's emails, and for checking in by scanning.
import { type TicketEvent, parseTicketCode } from '@ll/content';
import type { Db } from '@ll/db';
import { eventBookings, events, locations } from '@ll/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/** The event behind a reference, for its QR code and calendar file; null if there is none. */
export async function findTicket(db: Db, reference: string): Promise<TicketEvent | null> {
  if (parseTicketCode(reference) !== reference) return null;
  const [row] = await db
    .select({
      reference: eventBookings.reference,
      partySize: eventBookings.partySize,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venue: events.venue,
      address: locations.address,
    })
    .from(eventBookings)
    .innerJoin(events, eq(eventBookings.eventId, events.id))
    .leftJoin(locations, eq(events.locationId, locations.id))
    .where(eq(eventBookings.reference, reference))
    .limit(1);
  if (!row) return null;
  return {
    reference: row.reference,
    partySize: row.partySize,
    title: row.title,
    startsAt: row.startsAt.getTime(),
    endsAt: row.endsAt.getTime(),
    venue: row.venue || row.address || '',
  };
}

export type ScannedGuest = {
  id: string;
  reference: string;
  name: string;
  partySize: number;
  note: string;
  /** When they were checked in, now or earlier. */
  checkedInAt: number | null;
};

export type ScanResult =
  | { kind: 'checked-in'; guest: ScannedGuest }
  | { kind: 'already'; guest: ScannedGuest }
  | { kind: 'cancelled'; guest: ScannedGuest }
  /** On the waiting list: no place has been held, so they are not checked in. */
  | { kind: 'waitlisted'; guest: ScannedGuest }
  /** A ticket for another date or time of the event, or another event altogether. */
  | {
      kind: 'other-event';
      guest: ScannedGuest;
      event: { title: string; startsAt: number; timeZone: string };
    }
  | { kind: 'not-found' };

/**
 * Checks in the guest whose ticket was scanned for `eventId`. Only a confirmed
 * booking for this very event is checked in; anything else says why not.
 */
export async function checkInByCode(
  db: Db,
  eventId: string,
  code: string,
  userId: string,
  now = new Date()
): Promise<ScanResult> {
  const reference = parseTicketCode(code);
  if (!reference) return { kind: 'not-found' };
  const [row] = await db
    .select({ booking: eventBookings, event: events })
    .from(eventBookings)
    .innerJoin(events, eq(eventBookings.eventId, events.id))
    .where(eq(eventBookings.reference, reference))
    .limit(1);
  if (!row) return { kind: 'not-found' };

  const { booking: b, event: e } = row;
  const guest: ScannedGuest = {
    id: b.id,
    reference: b.reference,
    name: [b.firstName, b.lastName].filter(Boolean).join(' '),
    partySize: b.partySize,
    note: b.note ?? '',
    checkedInAt: b.checkedInAt?.getTime() ?? null,
  };
  if (b.status === 'cancelled') return { kind: 'cancelled', guest };
  if (b.status === 'waitlisted') return { kind: 'waitlisted', guest };
  if (b.eventId !== eventId) {
    return {
      kind: 'other-event',
      guest,
      event: { title: e.title, startsAt: e.startsAt.getTime(), timeZone: e.timeZone },
    };
  }
  if (b.checkedInAt) return { kind: 'already', guest };

  // Only if still not checked in, so two phones scanning at once agree on who was first.
  const updated = await db
    .update(eventBookings)
    .set({ checkedInAt: now, checkedInBy: userId })
    .where(and(eq(eventBookings.id, b.id), isNull(eventBookings.checkedInAt)))
    .returning({ checkedInAt: eventBookings.checkedInAt });
  if (updated.length === 0) {
    const [current] = await db
      .select({ checkedInAt: eventBookings.checkedInAt })
      .from(eventBookings)
      .where(eq(eventBookings.id, b.id));
    return {
      kind: 'already',
      guest: { ...guest, checkedInAt: current?.checkedInAt?.getTime() ?? null },
    };
  }
  return { kind: 'checked-in', guest: { ...guest, checkedInAt: now.getTime() } };
}

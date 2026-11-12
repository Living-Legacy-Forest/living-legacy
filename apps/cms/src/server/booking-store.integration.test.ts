import { eventBookings, events } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { type BookingDetails, insertBooking, updateBookingDetails } from './booking-store';

let slugs = 0;

async function addEvent(capacity: number | null) {
  const startsAt = new Date('2027-03-10T02:30:00Z');
  const [row] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${++slugs}`,
      startsAt,
      endsAt: startsAt,
      capacity,
      status: 'published',
    })
    .returning();
  return row!.id;
}

const details = (partySize: number, over: Partial<BookingDetails> = {}): BookingDetails => ({
  firstName: 'Alex',
  lastName: 'Rivers',
  email: 'alex@example.com',
  phone: null,
  partySize,
  note: null,
  ...over,
});

async function book(eventId: string, partySize: number) {
  const booking = await insertBooking(
    testDb(),
    { eventId, ...details(partySize), source: 'staff', consentAt: null },
    null
  );
  return booking!.id;
}

const stored = (id: string) =>
  testDb().query.eventBookings.findFirst({ where: eq(eventBookings.id, id) });

beforeEach(async () => {
  await testDb().delete(eventBookings);
  await testDb().delete(events);
});

describe('updateBookingDetails', () => {
  it('changes the details and marks the booking for the HubSpot sync again', async () => {
    const eventId = await addEvent(null);
    const id = await book(eventId, 2);
    await testDb()
      .update(eventBookings)
      .set({ crmSyncedAt: new Date() })
      .where(eq(eventBookings.id, id));

    const ok = await updateBookingDetails(
      testDb(),
      id,
      eventId,
      details(3, { firstName: 'Sam', note: 'Uses a wheelchair' }),
      null
    );
    expect(ok).toBe(true);
    expect(await stored(id)).toMatchObject({
      firstName: 'Sam',
      partySize: 3,
      note: 'Uses a wheelchair',
      crmSyncedAt: null,
    });
  });

  it('counts the booking’s own places as free when it grows', async () => {
    // 10 places: this booking has 2, another has 6, so it can grow to 4 but not 5.
    const eventId = await addEvent(10);
    const id = await book(eventId, 2);
    await book(eventId, 6);

    expect(await updateBookingDetails(testDb(), id, eventId, details(4), 10)).toBe(true);
    expect(await updateBookingDetails(testDb(), id, eventId, details(5), 10)).toBe(false);
    expect((await stored(id))?.partySize).toBe(4);
  });

  it('leaves a cancelled booking alone', async () => {
    const eventId = await addEvent(null);
    const id = await book(eventId, 2);
    await testDb()
      .update(eventBookings)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(eventBookings.id, id));

    expect(await updateBookingDetails(testDb(), id, eventId, details(1), null)).toBe(false);
    expect((await stored(id))?.partySize).toBe(2);
  });
});

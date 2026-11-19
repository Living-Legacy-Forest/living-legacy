import { eventBookings, events } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import {
  type BookingDetails,
  insertBooking,
  insertWaitlisted,
  promoteBooking,
  updateBookingDetails,
} from './booking-store';

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

describe('the waiting list', () => {
  async function wait(eventId: string, partySize: number) {
    const { id } = await insertWaitlisted(testDb(), { eventId, ...details(partySize) });
    return id;
  }

  it('adds a party that holds no place and has a reference', async () => {
    const eventId = await addEvent(4);
    const id = await wait(eventId, 3);
    const row = await stored(id);
    expect(row).toMatchObject({ status: 'waitlisted', partySize: 3, source: 'staff' });
    expect(row?.reference).toMatch(/^LL-/);
    // Nothing is held: a booking for the whole event still fits.
    expect(
      await insertBooking(testDb(), { eventId, ...details(4), source: 'staff', consentAt: null }, 4)
    ).not.toBeNull();
  });

  it('moves a party in when there is room, dated now and ready for the HubSpot sync', async () => {
    const eventId = await addEvent(5);
    const id = await wait(eventId, 3);
    await testDb()
      .update(eventBookings)
      .set({ createdAt: new Date('2026-01-01'), crmSyncedAt: new Date() })
      .where(eq(eventBookings.id, id));
    expect(await promoteBooking(testDb(), id, eventId, 3, 5)).toBe(true);
    const row = await stored(id);
    expect(row?.status).toBe('confirmed');
    expect(row?.crmSyncedAt).toBeNull();
    expect(row!.createdAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('will not overbook: it only moves in while the places are there', async () => {
    const eventId = await addEvent(5);
    await insertBooking(testDb(), { eventId, ...details(3), source: 'staff', consentAt: null }, 5);
    const id = await wait(eventId, 3);
    expect(await promoteBooking(testDb(), id, eventId, 3, 5)).toBe(false);
    expect((await stored(id))?.status).toBe('waitlisted');
  });

  it('moves a party in once someone else cancels', async () => {
    const eventId = await addEvent(5);
    const first = await book(eventId, 4);
    const id = await wait(eventId, 3);
    expect(await promoteBooking(testDb(), id, eventId, 3, 5)).toBe(false);
    await testDb()
      .update(eventBookings)
      .set({ status: 'cancelled' })
      .where(eq(eventBookings.id, first));
    expect(await promoteBooking(testDb(), id, eventId, 3, 5)).toBe(true);
  });

  it('only moves a party that is still waiting', async () => {
    const eventId = await addEvent(null);
    const confirmed = await book(eventId, 2);
    expect(await promoteBooking(testDb(), confirmed, eventId, 2, null)).toBe(false);
  });
});

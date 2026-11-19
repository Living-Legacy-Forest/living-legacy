// What the HubSpot sync picks up: booked guests, not people waiting for a place.
import { eventBookings, events } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { promoteBooking } from './booking-store';
import { pendingBookings } from './event-crm';

beforeEach(async () => {
  await testDb().delete(eventBookings);
  await testDb().delete(events);
});

async function addBooking(status: 'confirmed' | 'waitlisted' | 'cancelled', reference: string) {
  const db = testDb();
  const [event] = await db
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${reference}`,
      startsAt: new Date('2027-03-10T02:30:00Z'),
      endsAt: new Date('2027-03-10T04:30:00Z'),
      capacity: 10,
      status: 'published',
    })
    .returning();
  const id = crypto.randomUUID();
  await db.insert(eventBookings).values({
    id,
    eventId: event!.id,
    reference,
    firstName: 'Alex',
    email: 'alex@example.com',
    partySize: 2,
    status,
    source: 'staff',
    createdAt: new Date(),
  });
  return { id, eventId: event!.id };
}

describe('pending HubSpot bookings', () => {
  it('sends confirmed and cancelled bookings, and leaves out the waiting list', async () => {
    await addBooking('confirmed', 'LL-AAAAAA');
    await addBooking('cancelled', 'LL-BBBBBB');
    await addBooking('waitlisted', 'LL-CCCCCC');
    const pending = await pendingBookings(testDb());
    expect(pending.map((b) => b.reference).sort()).toEqual(['LL-AAAAAA', 'LL-BBBBBB']);
    expect(pending.map((b) => b.status).sort()).toEqual(['cancelled', 'confirmed']);
  });

  it('sends a waiting party once it is moved in, as a new booking', async () => {
    const { id, eventId } = await addBooking('waitlisted', 'LL-DDDDDD');
    expect(await pendingBookings(testDb())).toEqual([]);
    expect(await promoteBooking(testDb(), id, eventId, 2, 10)).toBe(true);
    const pending = await pendingBookings(testDb());
    expect(pending.map((b) => [b.reference, b.status])).toEqual([['LL-DDDDDD', 'confirmed']]);
    expect(
      (await testDb().query.eventBookings.findFirst({ where: eq(eventBookings.id, id) }))?.status
    ).toBe('confirmed');
  });
});

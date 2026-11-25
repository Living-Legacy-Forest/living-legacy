import { hashManageToken, type PublicBookingInput } from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { days, testDb } from '../../test/fixtures';
import {
  bookFromWebsite,
  cancelFromWebsite,
  DUPLICATE_MESSAGE,
  viewBooking,
} from './public-bookings';

const SECRET = 'test-manage-secret';
const startsAt = new Date('2027-03-10T02:30:00Z');
const now = startsAt.getTime() - days(7);

let slugs = 0;

async function addEvent(over: Partial<typeof events.$inferInsert> = {}) {
  const [row] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${++slugs}`,
      venue: 'The forest gate',
      startsAt,
      endsAt: startsAt,
      capacity: null,
      status: 'published',
      ...over,
    })
    .returning();
  return row!;
}

const input = (eventId: string, over: Partial<PublicBookingInput> = {}): PublicBookingInput => ({
  eventId,
  firstName: 'Alex',
  lastName: 'Rivers',
  email: 'alex@example.com',
  phone: '',
  partySize: 2,
  note: '',
  consent: true,
  ...over,
});

const stored = (id: string) =>
  testDb().query.eventBookings.findFirst({ where: eq(eventBookings.id, id) });

async function bookOk(eventId: string, over: Partial<PublicBookingInput> = {}) {
  const result = await bookFromWebsite(testDb(), input(eventId, over), SECRET, now);
  if (!result.ok) throw new Error(result.message);
  return result;
}

beforeEach(async () => {
  await testDb().delete(eventBookings);
  await testDb().delete(events);
});

describe('bookFromWebsite', () => {
  it('books an open event', async () => {
    const event = await addEvent();
    const result = await bookOk(event.id);
    expect(result.reference).toMatch(/^LL-/);

    const row = await stored(result.id);
    expect(row).toMatchObject({
      status: 'confirmed',
      source: 'website',
      email: 'alex@example.com',
      partySize: 2,
      phone: null,
    });
    expect(row?.consentAt?.getTime()).toBe(now);
    expect(row?.manageTokenHash).toBe(await hashManageToken(result.token));
    // Only the hash is kept, never the token itself.
    expect(Object.values(row!)).not.toContain(result.token);
  });

  it('never takes the last place twice', async () => {
    const event = await addEvent({ capacity: 2 });
    const results = await Promise.all([
      bookFromWebsite(testDb(), input(event.id, { email: 'a@example.com' }), SECRET, now),
      bookFromWebsite(testDb(), input(event.id, { email: 'b@example.com' }), SECRET, now),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed).toEqual({ ok: false, message: 'This event is fully booked.' });
  });

  describe('refuses what the rules refuse', () => {
    it.each([
      ['a draft', { status: 'draft' as const }, {}, 'This event is not open for bookings.'],
      ['a cancelled event', { status: 'cancelled' as const }, {}, 'This event has been cancelled.'],
      [
        'one past its close',
        { bookingsCloseAt: new Date(now - 1000) },
        {},
        'Bookings for this event have closed.',
      ],
      [
        'too many people',
        { maxPartySize: 6 },
        { partySize: 7 },
        'Bookings are limited to 6 people.',
      ],
    ])('%s', async (_name, eventOver, bookingOver, message) => {
      const event = await addEvent(eventOver);
      const result = await bookFromWebsite(testDb(), input(event.id, bookingOver), SECRET, now);
      expect(result).toEqual({ ok: false, message });
      expect(await testDb().select().from(eventBookings)).toHaveLength(0);
    });

    it('an event that does not exist', async () => {
      const result = await bookFromWebsite(testDb(), input('missing-id'), SECRET, now);
      expect(result).toEqual({ ok: false, message: 'This event is not open for bookings.' });
    });
  });

  it('refuses the same email twice', async () => {
    const event = await addEvent();
    await bookOk(event.id);
    const again = await bookFromWebsite(testDb(), input(event.id, { partySize: 1 }), SECRET, now);
    expect(again).toEqual({ ok: false, message: DUPLICATE_MESSAGE });
    expect(await testDb().select().from(eventBookings)).toHaveLength(1);
  });

  it('does not count a cancelled booking against the same email', async () => {
    const event = await addEvent();
    const first = await bookOk(event.id);
    await cancelFromWebsite(testDb(), first.reference, first.token);
    const again = await bookFromWebsite(testDb(), input(event.id), SECRET, now);
    expect(again.ok).toBe(true);
  });
});

describe('viewBooking', () => {
  it('shows the booking to the right token only', async () => {
    const event = await addEvent();
    const booked = await bookOk(event.id);

    expect(await viewBooking(testDb(), booked.reference, booked.token)).toEqual({
      reference: booked.reference,
      status: 'confirmed',
      firstName: 'Alex',
      partySize: 2,
      event: {
        title: 'Open day',
        slug: event.slug,
        startsAt: startsAt.getTime(),
        endsAt: startsAt.getTime(),
        timeZone: 'Australia/Melbourne',
        venue: 'The forest gate',
      },
    });
    expect(await viewBooking(testDb(), booked.reference, `${booked.token}x`)).toBeNull();
    expect(await viewBooking(testDb(), 'LL-NOPE00', booked.token)).toBeNull();
  });

  it('never shows a staff booking, which has no token', async () => {
    const event = await addEvent();
    const [row] = await testDb()
      .insert(eventBookings)
      .values({
        id: crypto.randomUUID(),
        eventId: event.id,
        reference: 'LL-STAFF1',
        firstName: 'Sam',
        partySize: 1,
        source: 'staff',
        createdAt: new Date(),
      })
      .returning();
    expect(await viewBooking(testDb(), row!.reference, '')).toBeNull();
    expect(await viewBooking(testDb(), row!.reference, 'a'.repeat(43))).toBeNull();
  });
});

describe('cancelFromWebsite', () => {
  it('cancels with the right token and frees the places', async () => {
    const event = await addEvent({ capacity: 2 });
    const booked = await bookOk(event.id);
    await testDb()
      .update(eventBookings)
      .set({ crmSyncedAt: new Date() })
      .where(eq(eventBookings.id, booked.id));

    // Wrong token: nothing changes.
    expect(await cancelFromWebsite(testDb(), booked.reference, `${booked.token}x`)).toBeNull();
    expect((await stored(booked.id))?.status).toBe('confirmed');

    const cancelled = await cancelFromWebsite(testDb(), booked.reference, booked.token);
    expect(cancelled).toMatchObject({ reference: booked.reference, status: 'cancelled' });
    const row = await stored(booked.id);
    expect(row?.status).toBe('cancelled');
    expect(row?.cancelledAt).not.toBeNull();
    expect(row?.crmSyncedAt).toBeNull();

    // The two places are free again.
    const next = await bookFromWebsite(
      testDb(),
      input(event.id, { email: 'sam@example.com' }),
      SECRET,
      now
    );
    expect(next.ok).toBe(true);
  });

  it('cancelling again changes nothing', async () => {
    const event = await addEvent();
    const booked = await bookOk(event.id);
    const at = new Date('2027-03-01T00:00:00Z');
    await cancelFromWebsite(testDb(), booked.reference, booked.token, at);
    const again = await cancelFromWebsite(
      testDb(),
      booked.reference,
      booked.token,
      new Date('2027-03-02T00:00:00Z')
    );
    expect(again?.status).toBe('cancelled');
    expect((await stored(booked.id))?.cancelledAt?.getTime()).toBe(at.getTime());
  });

  it('leaves a booking alone once the event has started', async () => {
    const event = await addEvent();
    const booked = await bookOk(event.id);
    const result = await cancelFromWebsite(
      testDb(),
      booked.reference,
      booked.token,
      new Date(startsAt.getTime() + 1)
    );
    expect(result?.status).toBe('confirmed');
    const row = await stored(booked.id);
    expect(row?.status).toBe('confirmed');
    expect(row?.cancelledAt).toBeNull();
  });

  it('leaves a checked-in booking alone', async () => {
    const event = await addEvent();
    const booked = await bookOk(event.id);
    await testDb()
      .update(eventBookings)
      .set({ checkedInAt: new Date(now) })
      .where(eq(eventBookings.id, booked.id));
    const result = await cancelFromWebsite(testDb(), booked.reference, booked.token, new Date(now));
    expect(result?.status).toBe('confirmed');
    expect((await stored(booked.id))?.status).toBe('confirmed');
  });
});

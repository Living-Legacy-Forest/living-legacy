import { eventBookings, events, locations } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { checkInByCode, findTicket } from './tickets';

const startsAt = new Date('2027-03-10T02:30:00Z');
let slugs = 0;

async function addEvent(values: Partial<typeof events.$inferInsert> = {}) {
  const [row] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${++slugs}`,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 7_200_000),
      status: 'published',
      ...values,
    })
    .returning();
  return row!.id;
}

async function book(
  eventId: string,
  reference: string,
  extra: Partial<typeof eventBookings.$inferInsert> = {}
) {
  await testDb()
    .insert(eventBookings)
    .values({
      id: reference,
      reference,
      eventId,
      firstName: 'Alex',
      lastName: 'Rivers',
      partySize: 2,
      source: 'website',
      createdAt: new Date('2027-03-01T00:00:00Z'),
      ...extra,
    });
}

beforeEach(async () => {
  await testDb().delete(eventBookings);
  await testDb().delete(events);
  await testDb().delete(locations);
});

describe('checkInByCode', () => {
  it('checks in a confirmed guest of this event, and says so if scanned again', async () => {
    const userId = await addUser('editor');
    const eventId = await addEvent();
    await book(eventId, 'LL-AAAAAA');
    const now = new Date('2027-03-10T02:20:00Z');

    const first = await checkInByCode(testDb(), eventId, 'll-aaaaaa', userId, now);
    expect(first).toMatchObject({
      kind: 'checked-in',
      guest: { name: 'Alex Rivers', partySize: 2, checkedInAt: now.getTime() },
    });
    const stored = await testDb().query.eventBookings.findFirst({
      where: eq(eventBookings.id, 'LL-AAAAAA'),
    });
    expect(stored?.checkedInBy).toBe(userId);

    const again = await checkInByCode(testDb(), eventId, 'LL-AAAAAA', userId);
    expect(again).toMatchObject({ kind: 'already', guest: { checkedInAt: now.getTime() } });
  });

  it('does not check in a cancelled booking', async () => {
    const userId = await addUser('editor');
    const eventId = await addEvent();
    await book(eventId, 'LL-BBBBBB', { status: 'cancelled', cancelledAt: new Date() });
    expect((await checkInByCode(testDb(), eventId, 'LL-BBBBBB', userId)).kind).toBe('cancelled');
  });

  it('does not check in a party on the waiting list', async () => {
    const userId = await addUser('editor');
    const eventId = await addEvent();
    await book(eventId, 'LL-WWWWWW', { status: 'waitlisted' });
    const result = await checkInByCode(testDb(), eventId, 'LL-WWWWWW', userId);
    expect(result.kind).toBe('waitlisted');
    const stored = await testDb().query.eventBookings.findFirst({
      where: eq(eventBookings.id, 'LL-WWWWWW'),
    });
    expect(stored?.checkedInAt).toBeNull();
  });

  it('names the other date when the ticket is for another event', async () => {
    const userId = await addUser('editor');
    const today = await addEvent();
    const later = await addEvent({ startsAt: new Date('2027-03-24T02:30:00Z') });
    await book(later, 'LL-CCCCCC');

    const result = await checkInByCode(testDb(), today, 'LL-CCCCCC', userId);
    expect(result).toMatchObject({
      kind: 'other-event',
      event: { startsAt: new Date('2027-03-24T02:30:00Z').getTime() },
    });
    const stored = await testDb().query.eventBookings.findFirst({
      where: eq(eventBookings.id, 'LL-CCCCCC'),
    });
    expect(stored?.checkedInAt).toBeNull();
  });

  it('finds nothing for an unknown or unreadable code', async () => {
    const userId = await addUser('editor');
    const eventId = await addEvent();
    expect((await checkInByCode(testDb(), eventId, 'LL-DDDDDD', userId)).kind).toBe('not-found');
    expect((await checkInByCode(testDb(), eventId, 'hello', userId)).kind).toBe('not-found');
  });
});

describe('findTicket', () => {
  it('gives the event of a booking, with the location address when there is no venue', async () => {
    const [place] = await testDb()
      .insert(locations)
      .values({
        name: 'Living Legacy Wellington Dam',
        slug: 'wellington-dam',
        state: 'WA',
        stage: 'live',
        address: '1 Wellington Dam Road, Worsley WA 6225',
      })
      .returning();
    const eventId = await addEvent({ locationId: place!.id });
    await book(eventId, 'LL-EEEEEE');

    expect(await findTicket(testDb(), 'LL-EEEEEE')).toEqual({
      reference: 'LL-EEEEEE',
      partySize: 2,
      title: 'Open day',
      startsAt: startsAt.getTime(),
      endsAt: startsAt.getTime() + 7_200_000,
      venue: '1 Wellington Dam Road, Worsley WA 6225',
    });
  });

  it('only looks up well-formed references', async () => {
    expect(await findTicket(testDb(), 'll-eeeeee')).toBeNull();
    expect(await findTicket(testDb(), "LL-EEEEEE' OR 1=1")).toBeNull();
  });
});

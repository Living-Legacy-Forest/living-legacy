import { eventBookings, events, locations } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { days, testDb } from '../../test/fixtures';
import { loadEventPage } from './events';

const now = new Date('2027-03-10T00:00:00Z').getTime();
const at = (offset: number) => new Date(now + offset);

let refs = 0;

async function addLocation(name: string, extra: Partial<typeof locations.$inferInsert> = {}) {
  const [row] = await testDb()
    .insert(locations)
    .values({
      name,
      slug: `${name.toLowerCase()}-${++refs}`,
      state: 'VIC',
      stage: 'live',
      ...extra,
    })
    .returning();
  return row!.id;
}

async function addEvent(values: Partial<typeof events.$inferInsert> & { startsAt: Date }) {
  const [row] = await testDb()
    .insert(events)
    .values({
      title: 'Open day',
      slug: `open-day-${++refs}`,
      endsAt: values.startsAt,
      status: 'published',
      ...values,
    })
    .returning();
  return row!.id;
}

async function book(
  eventId: string,
  partySize: number,
  extra: Partial<typeof eventBookings.$inferInsert> = {}
) {
  const reference = `LL-${String(++refs).padStart(6, '0')}`;
  await testDb()
    .insert(eventBookings)
    .values({
      id: reference,
      reference,
      eventId,
      firstName: 'Alex',
      partySize,
      source: 'website',
      createdAt: at(-days(1)),
      ...extra,
    });
}

describe('loadEventPage', () => {
  beforeEach(async () => {
    await testDb().delete(eventBookings);
    await testDb().delete(events);
    await testDb().delete(locations);
  });

  it('returns the event with its booking counts', async () => {
    const locationId = await addLocation('Mornington');
    const id = await addEvent({ startsAt: at(days(3)), capacity: 50, locationId });
    await book(id, 3, { checkedInAt: at(days(3)) });
    await book(id, 2);
    await book(id, 4, { status: 'cancelled' });

    const page = await loadEventPage(testDb(), id);

    expect(page?.event).toMatchObject({
      id,
      booked: 5,
      bookings: 2,
      checkedIn: 3,
      capacity: 50,
      locationName: 'Mornington',
    });
    expect(page?.dates).toEqual([]);
  });

  it('returns every date of its series, soonest first', async () => {
    const seriesId = 'series-1';
    const last = await addEvent({ startsAt: at(days(20)), seriesId });
    const first = await addEvent({ startsAt: at(days(6)), seriesId });
    const middle = await addEvent({ startsAt: at(days(13)), seriesId });
    await addEvent({ startsAt: at(days(7)), seriesId: 'other-series' });

    const page = await loadEventPage(testDb(), middle);

    expect(page?.dates.map((d) => d.id)).toEqual([first, middle, last]);
  });

  it('returns the live locations', async () => {
    const id = await addEvent({ startsAt: at(days(3)) });
    await addLocation('Daylesford');
    const gone = await addLocation('Retired');
    await testDb().update(locations).set({ deletedAt: new Date() }).where(eq(locations.id, gone));

    const page = await loadEventPage(testDb(), id);

    expect(page?.locations.map((l) => l.name)).toEqual(['Daylesford']);
  });

  it('returns null for an unknown id', async () => {
    expect(await loadEventPage(testDb(), 'nope')).toBeNull();
  });
});

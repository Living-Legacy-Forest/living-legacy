import { eventBookings, events, locations } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { days, testDb } from '../../test/fixtures';
import { loadEventDashboard, loadEventsOverview } from './event-stats';

const now = new Date('2027-03-10T00:00:00Z').getTime();
const at = (offset: number) => new Date(now + offset);

let refs = 0;

async function addLocation(name: string) {
  const [row] = await testDb()
    .insert(locations)
    .values({ name, slug: name.toLowerCase(), state: 'VIC', stage: 'live' })
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

const load = (options: Parameters<typeof loadEventsOverview>[1] = {}) =>
  loadEventsOverview(testDb(), options, now);

describe('loadEventsOverview', () => {
  beforeEach(async () => {
    await testDb().delete(eventBookings);
    await testDb().delete(events);
    await testDb().delete(locations);
  });

  it('lists published events in the next 30 days with the people booked', async () => {
    const soon = await addEvent({ startsAt: at(days(3)), capacity: 20 });
    await book(soon, 4);
    await book(soon, 2, { source: 'staff' });
    await book(soon, 5, { status: 'cancelled' });
    await addEvent({ startsAt: at(days(5)), status: 'draft' });
    await addEvent({ startsAt: at(days(6)), status: 'cancelled' });
    await addEvent({ startsAt: at(days(40)) });

    const { upcoming } = await load();

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({ id: soon, booked: 6, capacity: 20 });
  });

  it('counts people booked by when they booked and where from', async () => {
    const event = await addEvent({ startsAt: at(days(3)) });
    await book(event, 3, { createdAt: at(-days(1)) });
    await book(event, 2, { createdAt: at(-days(1)), source: 'staff' });
    await book(event, 4, { createdAt: at(-days(8)) });
    // Before the 30-day range.
    await book(event, 9, { createdAt: at(-days(45)) });

    const { bookings } = await load({ range: '30d' });

    expect(bookings).toHaveLength(30);
    expect(bookings.at(-2)).toMatchObject({ website: 3, staff: 2 });
    expect(bookings.at(-9)).toMatchObject({ website: 4, staff: 0 });
    expect(bookings.reduce((n, b) => n + b.website + b.staff, 0)).toBe(9);
  });

  it('measures turn-up only over past events that used check-in', async () => {
    const checked = await addEvent({ startsAt: at(-days(2)) });
    await book(checked, 4, { checkedInAt: at(-days(2)) });
    await book(checked, 2);
    // Nobody was checked in here, so it says nothing about turn-up.
    const unchecked = await addEvent({ startsAt: at(-days(2)) });
    await book(unchecked, 10);

    const { turnUp, turnUpTotals } = await load({ range: '30d' });

    expect(turnUpTotals).toEqual({ booked: 6, checkedIn: 4, events: 1 });
    expect(turnUp.at(-3)).toMatchObject({ checkedIn: 4, noShow: 2 });
  });

  it('narrows everything to one location', async () => {
    const north = await addLocation('North');
    const south = await addLocation('South');
    await book(await addEvent({ startsAt: at(days(2)), locationId: north }), 3);
    await book(await addEvent({ startsAt: at(days(2)), locationId: south }), 7);

    const all = await load();
    expect(all.byLocation).toEqual([
      { id: south, name: 'South', people: 7 },
      { id: north, name: 'North', people: 3 },
    ]);

    const one = await load({ location: north });
    expect(one.upcoming.map((e) => e.booked)).toEqual([3]);
    expect(one.weeklyBookings.at(-1)).toBe(3);
  });
});

describe('loadEventDashboard', () => {
  beforeEach(async () => {
    await testDb().delete(eventBookings);
    await testDb().delete(events);
  });

  it('adds up bookings, cancellations, turn-up and notes for one date', async () => {
    const start = at(-days(1));
    const id = await addEvent({ startsAt: start, capacity: 10 });
    await book(id, 4, { createdAt: at(-days(10)), checkedInAt: at(-days(1)), note: 'Wheelchair' });
    await book(id, 2, { createdAt: at(-days(2)), source: 'staff', note: '  ' });
    await book(id, 3, {
      createdAt: at(-days(5)),
      status: 'cancelled',
      cancelledAt: at(-days(1) - 60 * 60_000),
    });

    const d = await loadEventDashboard(testDb(), id, {}, now);

    expect(d.totals).toMatchObject({
      people: 6,
      bookings: 2,
      website: 4,
      staff: 2,
      checkedIn: 4,
      cancelledBookings: 1,
      cancelledPeople: 3,
      lateCancellations: 1,
      withNotes: 1,
    });
    expect(d.partySizes).toEqual([
      { size: 1, bookings: 0 },
      { size: 2, bookings: 1 },
      { size: 3, bookings: 0 },
      { size: 4, bookings: 1 },
    ]);
    expect(d.leadTime.find((b) => b.label === '1 to 2 weeks')?.bookings).toBe(1);
    expect(d.arrivals).toEqual([{ minutes: 0, people: 4 }]);
  });

  it('builds a running total of people booked up to the start', async () => {
    const id = await addEvent({ startsAt: at(days(2)) });
    await book(id, 2, { createdAt: at(-days(3)) });
    await book(id, 3, { createdAt: at(-days(1)) });

    const { timeline } = await loadEventDashboard(testDb(), id, {}, now);

    // Five days out to two days out (today).
    expect(timeline.map((t) => [t.daysBefore, t.people])).toEqual([
      [5, 2],
      [4, 2],
      [3, 5],
      [2, 5],
    ]);
  });

  it('spots people who booked an earlier event', async () => {
    const before = await addEvent({ startsAt: at(-days(30)) });
    await book(before, 2, { email: 'Sam@Example.test' });
    const id = await addEvent({ startsAt: at(days(3)) });
    await book(id, 2, { email: 'sam@example.test' });
    await book(id, 2, { email: 'new@example.test' });

    const d = await loadEventDashboard(testDb(), id, {}, now);

    expect(d.totals.repeatBookings).toBe(1);
  });

  it('covers every date of a series, or narrows to one', async () => {
    const first = await addEvent({ startsAt: at(-days(7)), seriesId: 's1', capacity: 10 });
    const second = await addEvent({ startsAt: at(days(7)), seriesId: 's1', capacity: 10 });
    await book(first, 5, { checkedInAt: at(-days(7)), createdAt: at(-days(9)) });
    await book(second, 2);

    // Opened from either date, the page is the whole event.
    const all = await loadEventDashboard(testDb(), second, {}, now);
    expect(all.date).toBeNull();
    expect(all.dates.map((d) => [d.id, d.booked, d.checkedIn])).toEqual([
      [first, 5, 5],
      [second, 2, 0],
    ]);
    expect(all.capacity).toBe(20);
    expect(all.totals).toMatchObject({ people: 7, checkedIn: 5, startedPeople: 5 });

    const one = await loadEventDashboard(testDb(), first, { date: second }, now);
    expect(one.date?.id).toBe(second);
    expect(one.capacity).toBe(10);
    expect(one.totals).toMatchObject({ people: 2, checkedIn: 0, startedPeople: 0 });
  });
});

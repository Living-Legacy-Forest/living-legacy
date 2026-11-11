import { eventBookings, events, locations } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { type SQL, and, asc, eq, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';

// The events overview: what's coming up and how full it is, then how bookings
// and turn-up went over a chosen range. Counts are people (party sizes), not
// bookings. Drafts, cancelled events and cancelled bookings never count.

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** How far ahead "coming up" looks. */
export const UPCOMING_DAYS = 30;
/** The stat card's bookings trend, in weeks. */
const TREND_WEEKS = 12;

export const overviewRanges = ['30d', '90d', '12m'] as const;
export type OverviewRange = (typeof overviewRanges)[number];

/** Each range as a run of equal buckets ending now: days for a month, weeks beyond. */
const RANGE_BUCKETS: Record<OverviewRange, { size: number; count: number }> = {
  '30d': { size: DAY_MS, count: 30 },
  '90d': { size: WEEK_MS, count: 13 },
  '12m': { size: WEEK_MS, count: 52 },
};

export const overviewSearch = z.object({
  range: z.enum(overviewRanges).optional().catch(undefined),
  location: z.string().max(64).optional().catch(undefined),
});

type Db = ReturnType<typeof getDb>;

// Outer columns for correlated subqueries. Drizzle leaves column names bare when a
// query reads one table, and a bare `id` inside a bookings subquery is the booking's.
const outerEventId = sql.raw('"events"."id"');
const outerBookingEmail = sql.raw('"event_bookings"."email"');
const outerBookingEventId = sql.raw('"event_bookings"."event_id"');
const outerEventStartsAt = sql.raw('"events"."starts_at"');

/** Buckets back from now: 0 is the latest. */
const bucketOf = (at: SQL | typeof events.startsAt, now: number, size: number) =>
  sql<number>`cast((${now} - ${at}) / ${size} as integer)`;

/** Oldest first: one entry per bucket, with its start time. */
function emptyBuckets<T>(now: number, size: number, count: number, make: () => T) {
  return Array.from({ length: count }, (_, i) => ({
    start: now - (count - i) * size,
    ...make(),
  }));
}

export async function loadEventsOverview(
  db: Db,
  { range = '90d', location }: { range?: OverviewRange; location?: string },
  now = Date.now()
) {
  const { size, count } = RANGE_BUCKETS[range];
  const rangeStart = now - size * count;
  const upcomingEnd = now + UPCOMING_DAYS * DAY_MS;
  const trendStart = now - TREND_WEEKS * WEEK_MS;

  const live = and(
    eq(events.status, 'published'),
    location ? eq(events.locationId, location) : undefined
  );
  const confirmed = eq(eventBookings.status, 'confirmed');
  const people = sql<number>`coalesce(sum(${eventBookings.partySize}), 0)`;
  const bookedFor = (where?: SQL) =>
    sql<number>`coalesce((select sum(${eventBookings.partySize}) from ${eventBookings} where ${eventBookings.eventId} = ${outerEventId} and ${confirmed}${where ? sql` and ${where}` : sql``}), 0)`;

  const checkedInFor = bookedFor(isNotNull(eventBookings.checkedInAt));
  const bookingBucket = bucketOf(sql`${eventBookings.createdAt}`, now, size);
  const eventBucket = bucketOf(events.startsAt, now, size);
  const trendWeek = bucketOf(sql`${eventBookings.createdAt}`, now, WEEK_MS);

  const [upcoming, bookedRows, turnUpRows, byLocation, trendRows, places] = await db.batch([
    db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        timeZone: events.timeZone,
        locationName: locations.name,
        capacity: events.capacity,
        bookingsCloseAt: events.bookingsCloseAt,
        booked: bookedFor(),
      })
      .from(events)
      .leftJoin(locations, eq(events.locationId, locations.id))
      .where(
        and(live, gte(events.startsAt, new Date(now)), lt(events.startsAt, new Date(upcomingEnd)))
      )
      .orderBy(asc(events.startsAt)),
    // When people booked, by where the booking came from.
    db
      .select({ bucket: bookingBucket, source: eventBookings.source, people })
      .from(eventBookings)
      .innerJoin(events, eq(eventBookings.eventId, events.id))
      .where(and(live, confirmed, gte(eventBookings.createdAt, new Date(rangeStart))))
      .groupBy(bookingBucket, eventBookings.source),
    // Past events in the range that used check-in: who was booked and who came.
    // Events nobody checked anyone in at say nothing about turn-up, so they are left out.
    db
      .select({
        bucket: eventBucket,
        booked: sql<number>`sum(${bookedFor()})`,
        checkedIn: sql<number>`sum(${checkedInFor})`,
        events: sql<number>`count(*)`,
      })
      .from(events)
      .where(
        and(
          live,
          gte(events.startsAt, new Date(rangeStart)),
          lt(events.startsAt, new Date(now)),
          sql`${checkedInFor} > 0`
        )
      )
      .groupBy(eventBucket),
    db
      .select({ id: locations.id, name: locations.name, people })
      .from(eventBookings)
      .innerJoin(events, eq(eventBookings.eventId, events.id))
      .innerJoin(locations, eq(events.locationId, locations.id))
      .where(and(live, confirmed, gte(eventBookings.createdAt, new Date(rangeStart))))
      .groupBy(locations.id, locations.name),
    db
      .select({ week: trendWeek, people })
      .from(eventBookings)
      .innerJoin(events, eq(eventBookings.eventId, events.id))
      .where(and(live, confirmed, gte(eventBookings.createdAt, new Date(trendStart))))
      .groupBy(trendWeek),
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(isNull(locations.deletedAt))
      .orderBy(asc(locations.sortOrder), asc(locations.name)),
  ]);

  const at = (bucket: number) => count - 1 - Number(bucket);
  const inRange = (bucket: number) => bucket >= 0 && bucket < count;

  const bookings = emptyBuckets(now, size, count, () => ({ website: 0, staff: 0 }));
  for (const row of bookedRows) {
    if (inRange(row.bucket)) bookings[at(row.bucket)]![row.source] += Number(row.people);
  }

  const turnUp = emptyBuckets(now, size, count, () => ({ checkedIn: 0, noShow: 0 }));
  const turnUpTotals = { booked: 0, checkedIn: 0, events: 0 };
  for (const row of turnUpRows) {
    if (!inRange(row.bucket)) continue;
    const rowBooked = Number(row.booked);
    const rowIn = Number(row.checkedIn);
    turnUp[at(row.bucket)]!.checkedIn += rowIn;
    turnUp[at(row.bucket)]!.noShow += Math.max(0, rowBooked - rowIn);
    turnUpTotals.booked += rowBooked;
    turnUpTotals.checkedIn += rowIn;
    turnUpTotals.events += Number(row.events);
  }

  const weeklyBookings = Array.from({ length: TREND_WEEKS }, () => 0);
  for (const row of trendRows) {
    const week = Number(row.week);
    if (week >= 0 && week < TREND_WEEKS)
      weeklyBookings[TREND_WEEKS - 1 - week] = Number(row.people);
  }

  return {
    range,
    location: location ?? null,
    bucket: size === DAY_MS ? ('day' as const) : ('week' as const),
    upcoming: upcoming.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt.getTime(),
      endsAt: e.endsAt.getTime(),
      timeZone: e.timeZone,
      locationName: e.locationName,
      capacity: e.capacity,
      bookingsCloseAt: e.bookingsCloseAt?.getTime() ?? null,
      booked: Number(e.booked),
    })),
    weeklyBookings,
    bookings,
    turnUp,
    turnUpTotals,
    byLocation: byLocation
      .map((l) => ({ id: l.id, name: l.name, people: Number(l.people) }))
      .sort((a, b) => b.people - a.people),
    locations: places,
  };
}

export type EventsOverview = Awaited<ReturnType<typeof loadEventsOverview>>;

export const getEventsOverview = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .validator(overviewSearch)
  .handler(({ data }) => loadEventsOverview(getDb(), data));

// One event: all its dates together, or one of them. How it filled, who booked
// and how the days went. A one-off event is a series of one.

const HOUR_MS = 3_600_000;
/** Check-ins are counted in slots this long, from each date's start. */
const ARRIVAL_SLOT_MS = 15 * 60_000;
/** A cancellation this close to the start is a late one. */
const LATE_CANCEL_MS = 48 * HOUR_MS;
/** The bookings chart starts no further back than this. */
const TIMELINE_MAX_DAYS = 90;

/** How far ahead people booked, as buckets of days before the start. */
export const LEAD_BUCKETS = [
  { label: 'Same day', max: 1 },
  { label: '1 to 3 days', max: 4 },
  { label: '4 to 7 days', max: 8 },
  { label: '1 to 2 weeks', max: 15 },
  { label: '2 to 4 weeks', max: 29 },
  { label: 'Over 4 weeks', max: Infinity },
] as const;

export const eventDashboardSearch = z.object({
  /** One date of the event; all of them when absent. */
  date: z.string().max(64).optional().catch(undefined),
});

export async function loadEventDashboard(
  db: Db,
  id: string,
  { date }: { date?: string } = {},
  now = Date.now()
) {
  const [opened] = await db
    .select({ seriesId: events.seriesId })
    .from(events)
    .where(eq(events.id, id));
  if (!opened) throw new Error('This event no longer exists.');
  const sameEvent = opened.seriesId ? eq(events.seriesId, opened.seriesId) : eq(events.id, id);

  const confirmed = eq(eventBookings.status, 'confirmed');
  const bookedFor = (where?: SQL) =>
    sql<number>`coalesce((select sum(${eventBookings.partySize}) from ${eventBookings} where ${eventBookings.eventId} = ${outerEventId} and ${confirmed}${where ? sql` and ${where}` : sql``}), 0)`;
  // Someone who booked an earlier event too, matched on email. Only the yes or no leaves here.
  const repeat = sql<number>`exists (
    select 1 from ${eventBookings} as earlier
    join ${events} as e2 on e2.id = earlier.event_id
    where ${outerBookingEmail} is not null
      and lower(earlier.email) = lower(${outerBookingEmail})
      and earlier.status = 'confirmed'
      and earlier.event_id <> ${outerBookingEventId}
      and e2.starts_at < ${outerEventStartsAt}
  )`;

  const [dateRows, bookingRows] = await db.batch([
    db
      .select({
        id: events.id,
        title: events.title,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        timeZone: events.timeZone,
        capacity: events.capacity,
        bookingsCloseAt: events.bookingsCloseAt,
        locationName: locations.name,
        booked: bookedFor(),
        checkedIn: bookedFor(isNotNull(eventBookings.checkedInAt)),
      })
      .from(events)
      .leftJoin(locations, eq(events.locationId, locations.id))
      .where(sameEvent)
      .orderBy(asc(events.startsAt)),
    db
      .select({
        eventId: eventBookings.eventId,
        startsAt: events.startsAt,
        partySize: eventBookings.partySize,
        status: eventBookings.status,
        source: eventBookings.source,
        createdAt: eventBookings.createdAt,
        cancelledAt: eventBookings.cancelledAt,
        checkedInAt: eventBookings.checkedInAt,
        hasNote: sql<number>`coalesce(trim(${eventBookings.note}), '') <> ''`,
        crmSyncedAt: eventBookings.crmSyncedAt,
        crmError: eventBookings.crmError,
        repeat,
      })
      .from(eventBookings)
      .innerJoin(events, eq(eventBookings.eventId, events.id))
      .where(sameEvent),
  ]);

  const dates = dateRows.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    startsAt: d.startsAt.getTime(),
    endsAt: d.endsAt.getTime(),
    timeZone: d.timeZone,
    capacity: d.capacity,
    bookingsCloseAt: d.bookingsCloseAt?.getTime() ?? null,
    locationName: d.locationName,
    booked: Number(d.booked),
    checkedIn: Number(d.checkedIn),
  }));
  // A one-off event is always "one date"; a series shows all dates unless one is picked.
  const picked = dates.find((d) => d.id === date) ?? (dates.length === 1 ? dates[0] : undefined);
  const selected = picked ? [picked] : dates;
  const inScope = new Set(selected.map((d) => d.id));
  const all = bookingRows.filter((b) => inScope.has(b.eventId));
  const live = all.filter((b) => b.status === 'confirmed');
  const cancelled = all.filter((b) => b.status === 'cancelled');
  const people = (rows: typeof all) => rows.reduce((n, b) => n + b.partySize, 0);
  const daysBefore = (b: (typeof all)[number]) =>
    Math.max(0, Math.floor((b.startsAt.getTime() - b.createdAt.getTime()) / DAY_MS));

  // Running total of people still booked, by days before their date.
  const firstDay = Math.min(TIMELINE_MAX_DAYS, Math.max(0, ...live.map(daysBefore)));
  const lastDay = Math.min(
    firstDay,
    ...selected.map((d) => Math.max(0, Math.ceil((d.startsAt - now) / DAY_MS)))
  );
  const perDay = new Map<number, number>();
  for (const b of live) {
    const day = Math.min(firstDay, daysBefore(b));
    perDay.set(day, (perDay.get(day) ?? 0) + b.partySize);
  }
  const timeline: { daysBefore: number; people: number }[] = [];
  let running = 0;
  for (let day = firstDay; day >= lastDay; day--) {
    running += perDay.get(day) ?? 0;
    timeline.push({ daysBefore: day, people: running });
  }

  const leadTime = LEAD_BUCKETS.map((bucket) => ({ label: bucket.label, bookings: 0 }));
  for (const b of live) {
    const days = daysBefore(b);
    leadTime[LEAD_BUCKETS.findIndex((bucket) => days < bucket.max)]!.bookings++;
  }

  const largest = Math.max(0, ...live.map((b) => b.partySize));
  const partySizes = Array.from({ length: largest }, (_, i) => ({
    size: i + 1,
    bookings: live.filter((b) => b.partySize === i + 1).length,
  }));

  // Arrivals per slot from each date's start; anyone early counts from half an hour before.
  const arrivals = new Map<number, number>();
  for (const b of live) {
    if (!b.checkedInAt) continue;
    const offset = b.checkedInAt.getTime() - b.startsAt.getTime();
    const slot = Math.max(-2, Math.floor(offset / ARRIVAL_SLOT_MS));
    arrivals.set(slot, (arrivals.get(slot) ?? 0) + b.partySize);
  }
  const slots = [...arrivals.keys()];
  const firstSlot = Math.min(...slots);
  const arrivalSlots = slots.length
    ? Array.from({ length: Math.max(...slots) - firstSlot + 1 }, (_, i) => ({
        minutes: ((firstSlot + i) * ARRIVAL_SLOT_MS) / 60_000,
        people: arrivals.get(firstSlot + i) ?? 0,
      }))
    : [];

  const started = live.filter((b) => b.startsAt.getTime() <= now);
  const first = picked ?? dates.find((d) => d.endsAt >= now) ?? dates[0]!;

  return {
    id,
    title: first.title,
    locationName: first.locationName,
    timeZone: first.timeZone,
    /** The date being shown, or null for all of them. */
    date: picked ?? null,
    dates,
    now,
    /** Places across what is shown; null when any date has no limit. */
    capacity: selected.every((d) => d.capacity !== null)
      ? selected.reduce((n, d) => n + (d.capacity ?? 0), 0)
      : null,
    totals: {
      people: people(live),
      bookings: live.length,
      website: people(live.filter((b) => b.source === 'website')),
      staff: people(live.filter((b) => b.source === 'staff')),
      checkedIn: people(live.filter((b) => b.checkedInAt)),
      /** People booked at dates that have begun: what turn-up is measured against. */
      startedPeople: people(started),
      cancelledBookings: cancelled.length,
      cancelledPeople: people(cancelled),
      lateCancellations: cancelled.filter(
        (b) => b.cancelledAt && b.startsAt.getTime() - b.cancelledAt.getTime() < LATE_CANCEL_MS
      ).length,
      withNotes: live.filter((b) => Number(b.hasNote)).length,
      repeatBookings: live.filter((b) => Number(b.repeat)).length,
    },
    crm: {
      synced: live.filter((b) => b.crmSyncedAt && !b.crmError).length,
      failed: live.filter((b) => b.crmError).length,
      waiting: live.filter((b) => !b.crmSyncedAt && !b.crmError).length,
      lastError: live.find((b) => b.crmError)?.crmError ?? null,
    },
    timeline,
    leadTime,
    partySizes,
    arrivals: arrivalSlots,
  };
}

export type EventDashboard = Awaited<ReturnType<typeof loadEventDashboard>>;

export const getEventDashboard = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .validator(eventDashboardSearch.extend({ id: z.string().max(64) }))
  .handler(({ data }) => loadEventDashboard(getDb(), data.id, data));

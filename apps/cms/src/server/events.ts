import {
  type RichTextDoc,
  type SeriesScope,
  capacityProblem,
  deleteEventProblem,
  eventInputSchema,
  sameClockOn,
  seriesScopeSchema,
  slugify,
  toZoned,
} from '@ll/content';
import type { Db } from '@ll/db';
import { eventBookings, events, locations } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';

const confirmed = sql`${eventBookings.status} = 'confirmed'`;

/** Marks an event's bookings as changed, so the HubSpot sync sends them again. */
const resync = (db: Db, eventId: string) =>
  db.update(eventBookings).set({ crmSyncedAt: null }).where(eq(eventBookings.eventId, eventId));

export const listEvents = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .handler(async () => {
    const db = getDb();
    const [rows, places] = await db.batch([
      db
        .select({
          event: events,
          locationName: locations.name,
          booked: sql<number>`coalesce((select sum(${eventBookings.partySize}) from ${eventBookings} where ${eventBookings.eventId} = ${events.id} and ${confirmed}), 0)`,
          bookings: sql<number>`(select count(*) from ${eventBookings} where ${eventBookings.eventId} = ${events.id} and ${confirmed})`,
          checkedIn: sql<number>`coalesce((select sum(${eventBookings.partySize}) from ${eventBookings} where ${eventBookings.eventId} = ${events.id} and ${confirmed} and ${eventBookings.checkedInAt} is not null), 0)`,
        })
        .from(events)
        .leftJoin(locations, eq(events.locationId, locations.id))
        .orderBy(desc(events.startsAt)),
      db
        .select({
          id: locations.id,
          name: locations.name,
          address: locations.address,
          email: locations.email,
          state: locations.state,
        })
        .from(locations)
        .where(isNull(locations.deletedAt))
        .orderBy(asc(locations.sortOrder), asc(locations.name)),
    ]);

    return {
      events: rows.map(({ event: e, locationName, booked, bookings, checkedIn }) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        locationId: e.locationId,
        locationName,
        venue: e.venue ?? '',
        startsAt: e.startsAt.getTime(),
        endsAt: e.endsAt.getTime(),
        summary: e.summary ?? '',
        description: (e.description as RichTextDoc | null) ?? null,
        heroMediaId: e.heroMediaId,
        capacity: e.capacity,
        maxPartySize: e.maxPartySize,
        bookingsCloseAt: e.bookingsCloseAt?.getTime() ?? null,
        seriesId: e.seriesId,
        timeZone: e.timeZone,
        status: e.status,
        booked: Number(booked),
        bookings: Number(bookings),
        checkedIn: Number(checkedIn),
      })),
      locations: places.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address ?? '',
        email: l.email ?? '',
        state: l.state,
      })),
    };
  });

export type EventsData = Awaited<ReturnType<typeof listEvents>>;
export type EventRow = EventsData['events'][number];
export type LocationOption = EventsData['locations'][number];

type EventRecord = typeof events.$inferSelect;
/** One statement in a D1 batch. */
type BatchItem = Parameters<Db['batch']>[0][number];

const pad = (n: number) => String(n).padStart(2, '0');
/** "1000" for 10:00 in `zone`, for a session's web address and matching sessions. */
const clockKey = (ms: number, zone: string) => {
  const w = toZoned(ms, zone);
  return `${pad(w.hour)}${pad(w.minute)}`;
};

/** "2026-11-14" in the event's time zone, for a series date's web address. */
const dayKey = (ms: number, zone: string) => {
  const w = toZoned(ms, zone);
  return `${w.year}-${pad(w.month + 1)}-${pad(w.day)}`;
};

/** The event and, for "this and upcoming dates", the later dates of its series. */
async function inScope(db: Db, event: EventRecord, scope: SeriesScope) {
  if (scope === 'one' || !event.seriesId) return [event];
  return db
    .select()
    .from(events)
    .where(and(eq(events.seriesId, event.seriesId), gte(events.startsAt, event.startsAt)))
    .orderBy(asc(events.startsAt));
}

async function peopleBooked(db: Db, eventId: string) {
  const [row] = await db
    .select({ taken: sql<number>`coalesce(sum(${eventBookings.partySize}), 0)` })
    .from(eventBookings)
    .where(and(eq(eventBookings.eventId, eventId), confirmed));
  return Number(row?.taken ?? 0);
}

export const saveEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(eventInputSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const slug = slugify(data.slug || data.title);
    if (!slug) throw new Error('Give the event a title or a web address.');
    // Each event keeps its own zone (its location's), not the site's.
    const timeZone = data.timeZone;
    const now = new Date();
    const shared = {
      title: data.title,
      timeZone: data.timeZone,
      locationId: data.locationId,
      venue: data.venue || null,
      summary: data.summary || null,
      description: data.description,
      heroMediaId: data.heroMediaId,
      capacity: data.capacity,
      maxPartySize: data.maxPartySize,
      status: data.status,
      updatedBy: context.user.id,
      updatedAt: now,
    };
    // Bookings close the same time ahead of each date.
    const closeBefore = data.bookingsCloseAt === null ? null : data.startsAt - data.bookingsCloseAt;
    const closeAt = (startsAt: number) =>
      closeBefore === null ? null : new Date(startsAt - closeBefore);

    if (!data.id) {
      const dates = [{ startsAt: data.startsAt, endsAt: data.endsAt }, ...data.moreDates];
      const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
      // Each date of a series has its own page, so its own address; with
      // several times on one day, the time tells them apart.
      const days = dates.map((d) => dayKey(d.startsAt, timeZone));
      const sameDay = new Set(days).size < days.length;
      const rows = dates.map((d, i) => ({
        ...shared,
        seriesId,
        slug: seriesId
          ? `${slug}-${days[i]}${sameDay ? `-${clockKey(d.startsAt, timeZone)}` : ''}`
          : slug,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
        bookingsCloseAt: closeAt(d.startsAt),
        createdBy: context.user.id,
      }));
      const clash = await db
        .select({ slug: events.slug })
        .from(events)
        .where(
          inArray(
            events.slug,
            rows.map((r) => r.slug)
          )
        )
        .limit(1);
      if (clash.length) {
        throw new Error('Another event already uses that web address. Change the slug.');
      }
      // One statement per date: D1 limits how many values one statement binds.
      const created = await db.batch([
        db.insert(events).values(rows[0]!).returning({ id: events.id }),
        ...rows.slice(1).map((r) => db.insert(events).values(r).returning({ id: events.id })),
        logActivity(db, {
          actorId: context.user.id,
          actorName: context.user.name,
          action: 'event.saved',
          summary:
            rows.length > 1
              ? `Created the event ${data.title} on ${rows.length} dates`
              : `Created the event ${data.title}`,
        }),
      ]);
      return { id: created[0][0]!.id, dates: rows.length };
    }

    const current = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!current) throw new Error('That event no longer exists.');
    if (current.status === 'cancelled') {
      throw new Error('This event is cancelled and can no longer be changed.');
    }
    const clash = await db.query.events.findFirst({
      where: and(eq(events.slug, slug), ne(events.id, current.id)),
    });
    if (clash) throw new Error('Another event already uses that web address. Change the slug.');

    // The other dates take only what was changed here, so a date given its own
    // capacity or times earlier keeps them unless that is what changed.
    const was = {
      title: current.title,
      timeZone: current.timeZone,
      locationId: current.locationId,
      venue: current.venue,
      summary: current.summary,
      description: current.description,
      heroMediaId: current.heroMediaId,
      capacity: current.capacity,
      maxPartySize: current.maxPartySize,
      status: current.status,
    };
    const patch = Object.fromEntries(
      Object.entries(shared).filter(
        ([key, value]) => key in was && was[key as keyof typeof was] !== value
      )
    ) as Partial<typeof shared>;
    const timesChanged =
      current.startsAt.getTime() !== data.startsAt || current.endsAt.getTime() !== data.endsAt;

    const targets = (await inScope(db, current, data.scope)).filter(
      (t) => t.status !== 'cancelled'
    );
    const statements: BatchItem[] = [];
    let changed = 0;
    for (const t of targets) {
      const isThis = t.id === current.id;
      const capacity = isThis ? data.capacity : (patch.capacity ?? t.capacity);
      const problem = capacityProblem(capacity, await peopleBooked(db, t.id));
      if (problem)
        throw new Error(isThis ? problem : `${dayKey(t.startsAt.getTime(), timeZone)}: ${problem}`);
      // A new time moves only the dates at this date's old time: with several
      // times a day, the other sessions keep theirs.
      const times = isThis
        ? { startsAt: data.startsAt, endsAt: data.endsAt }
        : timesChanged &&
            clockKey(t.startsAt.getTime(), current.timeZone) ===
              clockKey(current.startsAt.getTime(), current.timeZone)
          ? sameClockOn(t.startsAt.getTime(), data, timeZone)
          : null;
      // Nothing for this date to take (another session, nothing shared changed).
      if (!isThis && !times && Object.keys(patch).length === 0) continue;
      changed++;
      statements.push(
        db
          .update(events)
          .set({
            ...(isThis ? { ...shared, slug, bookingsCloseAt: closeAt(data.startsAt) } : patch),
            ...(times
              ? { startsAt: new Date(times.startsAt), endsAt: new Date(times.endsAt) }
              : {}),
            updatedBy: context.user.id,
            updatedAt: now,
          })
          .where(eq(events.id, t.id))
      );
      // HubSpot sends guests the details, so a change of time or place sends
      // the bookings to it again.
      const moved = isThis ? timesChanged : times !== null;
      if (
        moved ||
        'title' in patch ||
        'venue' in patch ||
        'locationId' in patch ||
        'timeZone' in patch
      ) {
        statements.push(resync(db, t.id));
      }
    }
    statements.push(
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.saved',
        summary:
          changed > 1
            ? `Updated the event ${data.title} on ${changed} dates`
            : `Updated the event ${data.title}`,
      })
    );
    await db.batch(statements as [BatchItem, ...BatchItem[]]);
    return { id: current.id, dates: changed };
  });

const scoped = z.object({ id: z.string(), scope: seriesScopeSchema });

export const cancelEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(scoped)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!event) throw new Error('That event no longer exists.');
    const targets = (await inScope(db, event, data.scope)).filter((t) => t.status !== 'cancelled');
    if (targets.length === 0) return { dates: 0 };
    const now = new Date();
    await db.batch([
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.cancelled',
        summary:
          targets.length > 1
            ? `Cancelled the event ${event.title} on ${targets.length} dates`
            : `Cancelled the event ${event.title}`,
      }),
      ...targets.flatMap((t) => [
        db
          .update(events)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            updatedAt: now,
            updatedBy: context.user.id,
          })
          .where(eq(events.id, t.id)),
        // HubSpot tells the guests, once it has the cancellation.
        resync(db, t.id),
      ]),
    ]);
    return { dates: targets.length };
  });

export const deleteEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(scoped)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!event) return { dates: 0 };
    const targets = await inScope(db, event, data.scope);
    for (const t of targets) {
      const [row] = await db
        .select({ n: sql<number>`count(*)` })
        .from(eventBookings)
        .where(and(eq(eventBookings.eventId, t.id), confirmed));
      const problem = deleteEventProblem(
        { status: t.status, endsAt: t.endsAt.getTime() },
        Number(row?.n ?? 0),
        Date.now()
      );
      if (problem) throw new Error(problem);
    }
    // Bookings cascade with each date: guest details go with the event.
    await db.batch([
      db.delete(events).where(
        inArray(
          events.id,
          targets.map((t) => t.id)
        )
      ),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.deleted',
        summary:
          targets.length > 1
            ? `Deleted the event ${event.title} on ${targets.length} dates`
            : `Deleted the event ${event.title}`,
      }),
    ]);
    return { dates: targets.length };
  });

import { capacityProblem, eventInputSchema, slugify } from '@ll/content';
import { eventBookings, events, locations } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';

const confirmed = sql`${eventBookings.status} = 'confirmed'`;

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
        description: e.description ?? '',
        heroMediaId: e.heroMediaId,
        capacity: e.capacity,
        maxPartySize: e.maxPartySize,
        bookingsCloseAt: e.bookingsCloseAt?.getTime() ?? null,
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
      })),
    };
  });

export type EventsData = Awaited<ReturnType<typeof listEvents>>;
export type EventRow = EventsData['events'][number];
export type LocationOption = EventsData['locations'][number];

export const saveEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(eventInputSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const slug = slugify(data.slug || data.title);
    if (!slug) throw new Error('Give the event a title or a web address.');

    const clash = await db.query.events.findFirst({
      where: data.id ? and(eq(events.slug, slug), ne(events.id, data.id)) : eq(events.slug, slug),
    });
    if (clash) throw new Error('Another event already uses that web address. Change the slug.');

    const values = {
      title: data.title,
      slug,
      locationId: data.locationId,
      venue: data.venue || null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      summary: data.summary || null,
      description: data.description || null,
      heroMediaId: data.heroMediaId,
      capacity: data.capacity,
      maxPartySize: data.maxPartySize,
      bookingsCloseAt: data.bookingsCloseAt === null ? null : new Date(data.bookingsCloseAt),
      status: data.status,
      updatedBy: context.user.id,
      updatedAt: new Date(),
    };

    let id = data.id;
    if (id) {
      const current = await db.query.events.findFirst({ where: eq(events.id, id) });
      if (!current) throw new Error('That event no longer exists.');
      if (current.status === 'cancelled') {
        throw new Error('This event is cancelled and can no longer be changed.');
      }
      const [row] = await db
        .select({ taken: sql<number>`coalesce(sum(${eventBookings.partySize}), 0)` })
        .from(eventBookings)
        .where(and(eq(eventBookings.eventId, id), confirmed));
      const problem = capacityProblem(data.capacity, Number(row?.taken ?? 0));
      if (problem) throw new Error(problem);
      // A new start time earns a fresh reminder.
      const moved = current.startsAt.getTime() !== data.startsAt;
      await db.batch([
        db
          .update(events)
          .set({ ...values, ...(moved ? { reminderSentAt: null } : {}) })
          .where(eq(events.id, id)),
        logActivity(db, {
          actorId: context.user.id,
          actorName: context.user.name,
          action: 'event.saved',
          summary: `Updated the event ${data.title}`,
        }),
      ]);
    } else {
      const [created] = await db
        .insert(events)
        .values({ ...values, createdBy: context.user.id })
        .returning({ id: events.id });
      id = created!.id;
      await logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.saved',
        summary: `Created the event ${data.title}`,
      });
    }
    return { id };
  });

export const cancelEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!event) throw new Error('That event no longer exists.');
    if (event.status === 'cancelled') return { notified: 0 };
    const now = new Date();
    await db.batch([
      db
        .update(events)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now, updatedBy: context.user.id })
        .where(eq(events.id, event.id)),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.cancelled',
        summary: `Cancelled the event ${event.title}`,
      }),
    ]);
    // Task 5 emails the guests here and returns how many were told.
    return { notified: 0 };
  });

export const deleteEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!event) return;
    // Bookings cascade with it: guest details go with the event.
    await db.batch([
      db.delete(events).where(eq(events.id, event.id)),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.deleted',
        summary: `Deleted the event ${event.title}`,
      }),
    ]);
  });

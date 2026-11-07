import { BOOKING_RETENTION_DAYS } from '@ll/content';
import { createDb } from '@ll/db';
import { activityLog, eventBookings, events, user } from '@ll/db/schema';
import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Guest details go a year after the event ends; the event row stays. */
export async function purgeOldBookings(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const cutoff = new Date(now.getTime() - BOOKING_RETENTION_DAYS * DAY_MS);
  const old = db.select({ id: events.id }).from(events).where(lte(events.endsAt, cutoff));
  await db.delete(eventBookings).where(inArray(eventBookings.eventId, old));
}

/**
 * Every five minutes: drafts whose publish time has come go live. Credited, in
 * Activity, to whoever last saved the event, which set the time. Dates of one
 * series that go live together are one entry.
 */
export async function publishDueEvents(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const due = await db
    .select({
      id: events.id,
      seriesId: events.seriesId,
      title: events.title,
      updatedBy: events.updatedBy,
      actorName: user.name,
    })
    .from(events)
    .leftJoin(user, eq(user.id, events.updatedBy))
    .where(
      and(eq(events.status, 'draft'), isNotNull(events.publishAt), lte(events.publishAt, now))
    );
  if (due.length === 0) return { published: 0 };

  const groups = new Map<string, typeof due>();
  for (const e of due) {
    const key = e.seriesId ?? e.id;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const statements = [
    // Still a draft at the moment of writing: someone may have just published
    // or cancelled it by hand.
    ...due.map((e) =>
      db
        .update(events)
        .set({ status: 'published', publishAt: null, updatedAt: now })
        .where(and(eq(events.id, e.id), eq(events.status, 'draft')))
    ),
    ...[...groups.values()].map((dates) => {
      const first = dates[0]!;
      return db.insert(activityLog).values({
        actorId: first.updatedBy,
        actorName: first.actorName ?? 'Scheduled',
        action: 'event.published',
        summary:
          dates.length > 1
            ? `Published the event ${first.title} on ${dates.length} dates, as scheduled`
            : `Published the event ${first.title}, as scheduled`,
      });
    }),
  ];
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
  return { published: due.length };
}

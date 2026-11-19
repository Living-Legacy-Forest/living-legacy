import type { Db } from '@ll/db';
import type { ActivityAction } from '@ll/db/enums';
import { activityLog } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { type SQL, and, count, desc, eq, gte, isNotNull, like, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { pageSizeParam } from '@/lib/page-size';
import { dayKey, dayKeys } from '@/lib/dashboard-trend';
import { authMiddleware, requirePermission } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { isDayKey, zoneDayRange } from '@/lib/zone-day';

export type LogEntry = {
  actorId: string | null;
  actorName: string;
  action: ActivityAction;
  summary: string;
};

/**
 * Returns an insert statement rather than running it, so callers can batch it
 * atomically alongside the write it is describing.
 */
export function logActivity(db: Db, entry: LogEntry) {
  return db.insert(activityLog).values(entry);
}

/** Entries per page on the Activity page, and the other sizes it offers. */
export const ACTIVITY_PAGE_SIZES = [15, 25, 50, 100] as const;
export const ACTIVITY_PAGE_SIZE = ACTIVITY_PAGE_SIZES[0];

/** What the log can be narrowed to: the part of each action before the dot. */
export const activityKinds = ['post', 'event', 'user', 'redirect', 'settings', 'api_key'] as const;
export type ActivityKind = (typeof activityKinds)[number];

/** How far back the calendar reaches: a year of days, today included. */
const CALENDAR_DAYS = 365;

export type ActivityDay = { date: string; count: number };

/**
 * Changes per day over the last year, in the site's time zone, for what `where` narrows to.
 * Only the times are read, and the log is small, so the days are counted here rather than in
 * SQL, which has no notion of the site's zone.
 */
async function calendar(zone: string, where: SQL | undefined): Promise<ActivityDay[]> {
  const days = dayKeys(CALENDAR_DAYS, zone);
  // A day either side of the year, as the zone's day may start the UTC day before.
  const since = new Date(Date.now() - (CALENDAR_DAYS + 1) * 86_400_000);
  const rows = await getDb()
    .select({ at: activityLog.createdAt })
    .from(activityLog)
    .where(and(gte(activityLog.createdAt, since), where));
  const counts = new Map(days.map((d) => [d, 0]));
  for (const { at } of rows) {
    const key = dayKey(at.getTime(), zone);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date)! }));
}

/**
 * Who did what: post publishing, events, people, redirects, settings and API
 * keys, a page at a time, optionally for one kind of change or one person.
 */
export const listActivity = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(
    z.object({
      page: z.number().int().min(1).catch(1),
      /** Entries a page; anything but a size on offer is the usual one. */
      rows: pageSizeParam(ACTIVITY_PAGE_SIZES),
      kind: z.enum(activityKinds).optional().catch(undefined),
      who: z.string().max(64).optional().catch(undefined),
      /** One day, YYYY-MM-DD in the site's time zone, picked on the calendar. */
      day: z.string().refine(isDayKey).optional().catch(undefined),
    })
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { timeZone } = await readSiteSettings();
    // The calendar shows the year for the kind and person chosen; the day narrows the list only.
    const filters = and(
      data.kind ? like(activityLog.action, `${data.kind}.%`) : undefined,
      data.who ? eq(activityLog.actorId, data.who) : undefined
    );
    const range = data.day ? zoneDayRange(data.day, timeZone) : null;
    const where = and(
      filters,
      range ? gte(activityLog.createdAt, new Date(range[0])) : undefined,
      range ? lt(activityLog.createdAt, new Date(range[1])) : undefined
    );
    const [[{ total } = { total: 0 }], people] = await db.batch([
      db.select({ total: count() }).from(activityLog).where(where),
      // Everyone in the log, under the name they last acted with. Entries
      // whose person has since been removed have no id and are not offered.
      db
        .select({
          id: activityLog.actorId,
          name: sql<string>`(select latest.actor_name from activity_log as latest where latest.actor_id = ${activityLog.actorId} order by latest.created_at desc limit 1)`,
        })
        .from(activityLog)
        .where(isNotNull(activityLog.actorId))
        .groupBy(activityLog.actorId),
    ]);
    const pageSize = data.rows ?? ACTIVITY_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    // A page past the end (an old link, entries since removed) shows the last one.
    const page = Math.min(data.page, pageCount);
    const rows = await db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return {
      days: await calendar(timeZone, filters),
      rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })),
      page,
      pageCount,
      pageSize,
      total,
      people: people
        .filter((p): p is typeof p & { id: string } => p.id !== null)
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

export type ActivityLogData = Awaited<ReturnType<typeof listActivity>>;
export type ActivityLogEntry = ActivityLogData['rows'][number];

/** The signed-in person's own changes per day over the last year, for their profile. */
export const getMyActivity = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { timeZone } = await readSiteSettings();
    return calendar(timeZone, eq(activityLog.actorId, context.user.id));
  });

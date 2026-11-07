import type { Db } from '@ll/db';
import type { ActivityAction } from '@ll/db/enums';
import { activityLog } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, count, desc, eq, isNotNull, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';

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

export const ACTIVITY_PAGE_SIZE = 50;

/** What the log can be narrowed to: the part of each action before the dot. */
export const activityKinds = ['post', 'event', 'user', 'redirect', 'settings', 'api_key'] as const;
export type ActivityKind = (typeof activityKinds)[number];

/**
 * Who did what: post publishing, events, people, redirects, settings and API
 * keys, a page at a time, optionally for one kind of change or one person.
 */
export const listActivity = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(
    z.object({
      page: z.number().int().min(1).catch(1),
      kind: z.enum(activityKinds).optional().catch(undefined),
      who: z.string().max(64).optional().catch(undefined),
    })
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const where = and(
      data.kind ? like(activityLog.action, `${data.kind}.%`) : undefined,
      data.who ? eq(activityLog.actorId, data.who) : undefined
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
    const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
    // A page past the end (an old link, entries since removed) shows the last one.
    const page = Math.min(data.page, pageCount);
    const rows = await db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE);
    return {
      rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })),
      page,
      pageCount,
      total,
      people: people
        .filter((p): p is typeof p & { id: string } => p.id !== null)
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

export type ActivityLogData = Awaited<ReturnType<typeof listActivity>>;
export type ActivityLogEntry = ActivityLogData['rows'][number];

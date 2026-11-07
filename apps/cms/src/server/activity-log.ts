import type { Db } from '@ll/db';
import type { ActivityAction } from '@ll/db/enums';
import { activityLog } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { count, desc } from 'drizzle-orm';
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

/** Who did what: post publishing, team changes, redirects and settings, a page at a time. */
export const listActivity = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(z.object({ page: z.number().int().min(1).catch(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(activityLog);
    const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
    // A page past the end (an old link, entries since removed) shows the last one.
    const page = Math.min(data.page, pageCount);
    const rows = await db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE);
    return {
      rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })),
      page,
      pageCount,
      total,
    };
  });

export type ActivityLogData = Awaited<ReturnType<typeof listActivity>>;
export type ActivityLogEntry = ActivityLogData['rows'][number];

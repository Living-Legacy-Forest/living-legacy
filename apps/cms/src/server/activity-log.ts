import type { Db } from '@llf/db';
import type { ActivityAction } from '@llf/db/enums';
import { activityLog } from '@llf/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { desc } from 'drizzle-orm';
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

/** Who did what: post publishing, team changes, redirects and settings. */
export const listActivity = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .handler(async () => {
    const rows = await getDb()
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
  });

export type ActivityLogData = Awaited<ReturnType<typeof listActivity>>;
export type ActivityLogEntry = ActivityLogData[number];

// The destructive actions kept for super admins. Each leaves a note in the activity log, so that
// clearing the log or the usage is never silent. Kept apart from the server functions so it runs
// under the integration tests.
import type { Db } from '@ll/db';
import { activityLog, aiUsage } from '@ll/db/schema';
import { count } from 'drizzle-orm';
import { logActivity } from './activity-log';

type Actor = { id: string; name: string };

const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/** Removes every activity entry and adds one saying who did it. Returns how many were removed. */
export async function clearActivityEntries(db: Db, actor: Actor): Promise<number> {
  const [row] = await db.select({ n: count() }).from(activityLog);
  const removed = Number(row?.n ?? 0);
  await db.batch([
    db.delete(activityLog),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'activity.cleared',
      summary: `Cleared the activity log (${entries(removed)})`,
    }),
  ]);
  return removed;
}

/** Removes every person's writing assistant counts and history. Returns how many rows went. */
export async function resetAssistantCounts(db: Db, actor: Actor): Promise<number> {
  const [row] = await db.select({ n: count() }).from(aiUsage);
  const removed = Number(row?.n ?? 0);
  await db.batch([
    db.delete(aiUsage),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'settings.assistant_reset',
      summary: 'Reset the writing assistant usage',
    }),
  ]);
  return removed;
}

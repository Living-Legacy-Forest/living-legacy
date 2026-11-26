// The destructive actions kept for super admins. Each leaves a note in the activity log, so that
// clearing the log or the usage is never silent. Kept apart from the server functions so it runs
// under the integration tests.
import type { Db } from '@ll/db';
import { activityLog, aiUsage } from '@ll/db/schema';
import { count, eq } from 'drizzle-orm';
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

/**
 * Removes one activity entry and adds a note saying who did it, and which kind of entry and whose
 * it was (never what it said, since that is often why it is being removed). Returns false, and
 * writes no note, when the entry is already gone, so a second click or a stale page changes nothing.
 */
export async function removeActivityEntry(db: Db, actor: Actor, id: string): Promise<boolean> {
  const [entry] = await db
    .select({ action: activityLog.action, actorName: activityLog.actorName })
    .from(activityLog)
    .where(eq(activityLog.id, id));
  if (!entry) return false;
  const by = entry.actorName || 'someone';
  await db.batch([
    db.delete(activityLog).where(eq(activityLog.id, id)),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'activity.entry_removed',
      summary: `Removed an entry from the activity log (${entry.action} by ${by})`,
    }),
  ]);
  return true;
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

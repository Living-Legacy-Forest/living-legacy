import type { Db } from '@ll/db';
import { activityLog } from '@ll/db/schema';

export type PasskeyChange = 'user.passkey_added' | 'user.passkey_removed';

const summaries: Record<PasskeyChange, string> = {
  'user.passkey_added': 'Added a passkey',
  'user.passkey_removed': 'Removed a passkey',
};

/**
 * The activity log line for someone adding or removing one of their own passkeys. Writes the row
 * itself rather than through activity-log.ts, which lib/auth.ts (its caller) cannot import
 * without a cycle back through lib/session.ts.
 */
export function logPasskeyChange(
  db: Db,
  actor: { id: string; name: string },
  action: PasskeyChange
) {
  return db.insert(activityLog).values({
    actorId: actor.id,
    actorName: actor.name,
    action,
    summary: summaries[action],
  });
}

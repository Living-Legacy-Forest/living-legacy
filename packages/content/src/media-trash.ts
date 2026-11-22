// The media trash: a deleted file waits here, restorable, before it is removed for good. Its
// stored objects stay until then, so restoring the database from a backup within the window
// still finds them. Pure, so the CMS's job and its library share one rule.

/** How long a file stays in the trash before the daily job deletes it for good. */
export const MEDIA_TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Files moved to the trash before this moment are due to be deleted for good. */
export function mediaPurgeCutoff(now: Date): Date {
  return new Date(now.getTime() - MEDIA_TRASH_DAYS * DAY_MS);
}

/**
 * Whole days until a trashed file is deleted for good, for the trash view. Never below 0: a file
 * past its time waits for the next daily run.
 */
export function daysLeftInTrash(deletedAt: Date | number, now: Date): number {
  const deleted = typeof deletedAt === 'number' ? deletedAt : deletedAt.getTime();
  const left = deleted + MEDIA_TRASH_DAYS * DAY_MS - now.getTime();
  return Math.max(0, Math.ceil(left / DAY_MS));
}

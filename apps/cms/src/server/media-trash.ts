/**
 * The media trash. Deleting a file from the library moves it here: it leaves the library, the
 * pickers and the website (its public address answers 404), but its stored objects stay, so it
 * can be restored. Deleting from the trash, or the daily job after MEDIA_TRASH_DAYS, removes it
 * for good. Kept out of the server functions so the integration tests run it against local R2
 * and D1; the server functions check permissions and whether a file is in use.
 */
import { mediaPurgeCutoff } from '@ll/content';
import { type Db, createDb } from '@ll/db';
import { media, mediaVersions } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { and, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { logActivity } from './activity-log';
import { forgetCachedMedia } from './media-delivery';

type Actor = { id: string; name: string };

const files = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;
/** "tree.jpg", or "3 files" when there are several. */
const named = (rows: { filename: string }[]) =>
  rows.length === 1 ? rows[0]!.filename : files(rows.length);

/** Moves files to the trash. Files already there are left as they are. Returns how many moved. */
export async function trashMedia(
  db: Db,
  { ids, actor, origin }: { ids: string[]; actor: Actor; origin: string }
): Promise<number> {
  const rows = await db
    .select({ id: media.id, filename: media.filename })
    .from(media)
    .where(and(inArray(media.id, ids), isNull(media.deletedAt)));
  if (!rows.length) return 0;
  await db.batch([
    db
      .update(media)
      .set({ deletedAt: new Date(), deletedBy: actor.id })
      .where(
        inArray(
          media.id,
          rows.map((r) => r.id)
        )
      ),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'media.trashed',
      summary: `Moved ${named(rows)} to the trash`,
    }),
  ]);
  // Its public address stops answering at once here; other data centres follow as their copies
  // expire, as they did when a delete was immediate.
  await forgetCachedMedia(
    origin,
    rows.map((r) => r.id)
  );
  return rows.length;
}

/** Takes files out of the trash, back into the library. Returns how many came back. */
export async function untrashMedia(
  db: Db,
  { ids, actor }: { ids: string[]; actor: Actor }
): Promise<number> {
  const rows = await db
    .select({ id: media.id, filename: media.filename })
    .from(media)
    .where(and(inArray(media.id, ids), isNotNull(media.deletedAt)));
  if (!rows.length) return 0;
  await db.batch([
    db
      .update(media)
      .set({ deletedAt: null, deletedBy: null })
      .where(
        inArray(
          media.id,
          rows.map((r) => r.id)
        )
      ),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'media.untrashed',
      summary: `Restored ${named(rows)} from the trash`,
    }),
  ]);
  return rows.length;
}

/**
 * Deletes trashed files for good: their stored objects, earlier versions and rows. A file not in
 * the trash is left alone. A row goes only once its objects have, so a failed storage call
 * leaves the file in the trash to try again rather than objects nobody points at.
 */
export async function deleteTrashedMedia(
  db: Db,
  {
    ids,
    actor,
    origin,
  }: {
    ids: string[];
    /** Null for the daily job. */
    actor: Actor | null;
    origin: string;
  }
): Promise<{ removed: number; failed: number }> {
  const rows = await db
    .select({
      id: media.id,
      filename: media.filename,
      r2Key: media.r2Key,
      variants: media.variants,
    })
    .from(media)
    .where(and(inArray(media.id, ids), isNotNull(media.deletedAt)));
  if (!rows.length) return { removed: 0, failed: 0 };

  const older = await db
    .select({
      mediaId: mediaVersions.mediaId,
      r2Key: mediaVersions.r2Key,
      variants: mediaVersions.variants,
    })
    .from(mediaVersions)
    .where(
      inArray(
        mediaVersions.mediaId,
        rows.map((r) => r.id)
      )
    );
  const keysOf = (row: (typeof rows)[number]) => [
    row.r2Key,
    ...(row.variants ?? []).map((v) => v.key),
    ...older
      .filter((v) => v.mediaId === row.id)
      .flatMap((v) => [v.r2Key, ...(v.variants ?? []).map((x) => x.key)]),
  ];

  const results = await Promise.allSettled(rows.map((row) => env.MEDIA.delete(keysOf(row))));
  const removed = rows.filter((_, i) => results[i]!.status === 'fulfilled');
  if (removed.length) {
    await db.batch([
      // Earlier versions follow their row (on delete cascade).
      db.delete(media).where(
        inArray(
          media.id,
          removed.map((r) => r.id)
        )
      ),
      logActivity(db, {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'Scheduled',
        action: 'media.deleted',
        summary: actor
          ? `Deleted ${named(removed)} for good`
          : `Deleted ${named(removed)} for good after their time in the trash`,
      }),
    ]);
    await forgetCachedMedia(
      origin,
      removed.map((r) => r.id)
    );
  }
  return { removed: removed.length, failed: rows.length - removed.length };
}

/** The daily job: deletes for good every file that has been in the trash past its time. */
export async function purgeTrashedMedia(d1: D1Database, now: Date, origin: string) {
  const db = createDb(d1);
  const due = await db
    .select({ id: media.id })
    .from(media)
    .where(and(isNotNull(media.deletedAt), lt(media.deletedAt, mediaPurgeCutoff(now))));
  const total = { removed: 0, failed: 0 };
  // D1 takes at most 100 bound values a query, and each chunk's ids are bound.
  for (let i = 0; i < due.length; i += PURGE_CHUNK) {
    const { removed, failed } = await deleteTrashedMedia(db, {
      ids: due.slice(i, i + PURGE_CHUNK).map((r) => r.id),
      actor: null,
      origin,
    });
    total.removed += removed;
    total.failed += failed;
  }
  return total;
}

const PURGE_CHUNK = 50;

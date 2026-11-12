// Who else has a post open, and whether someone else saved it since this
// editor loaded it. Read and written every 20 seconds by each open editor.
import type { Db } from '@ll/db';
import { postPresence, posts, user } from '@ll/db/schema';
import { and, eq, gte, lt, ne } from 'drizzle-orm';

/** An editor not heard from for this long has gone (closed, asleep or offline). */
export const PRESENCE_TIMEOUT_MS = 60_000;

export type Editor = { id: string; name: string; image: string | null; avatarSeed: string | null };
export type Presence = {
  others: Editor[];
  /** Someone else saved after `since`: who and when. */
  newerSave: { name: string; at: number } | null;
};

export async function checkIn(
  db: Db,
  postId: string,
  userId: string,
  since: number | null,
  now = new Date()
): Promise<Presence> {
  const fresh = new Date(now.getTime() - PRESENCE_TIMEOUT_MS);
  const [, , others, [post]] = await db.batch([
    db
      .insert(postPresence)
      .values({ postId, userId, seenAt: now })
      .onConflictDoUpdate({
        target: [postPresence.postId, postPresence.userId],
        set: { seenAt: now },
      }),
    // Tidy as we go, so the table only ever holds open editors.
    db.delete(postPresence).where(lt(postPresence.seenAt, new Date(now.getTime() - 5 * 60_000))),
    db
      .select({ id: user.id, name: user.name, image: user.image, avatarSeed: user.avatarSeed })
      .from(postPresence)
      .innerJoin(user, eq(user.id, postPresence.userId))
      .where(
        and(
          eq(postPresence.postId, postId),
          ne(postPresence.userId, userId),
          gte(postPresence.seenAt, fresh)
        )
      ),
    db
      .select({ updatedAt: posts.updatedAt, updatedBy: posts.updatedBy, name: user.name })
      .from(posts)
      .leftJoin(user, eq(user.id, posts.updatedBy))
      .where(eq(posts.id, postId)),
  ]);
  const newerSave =
    post && since !== null && post.updatedAt.getTime() > since && post.updatedBy !== userId
      ? { name: post.name ?? 'Someone', at: post.updatedAt.getTime() }
      : null;
  return { others, newerSave };
}

/** The editor was closed: stop showing it to others straight away. */
export async function checkOut(db: Db, postId: string, userId: string) {
  await db
    .delete(postPresence)
    .where(and(eq(postPresence.postId, postId), eq(postPresence.userId, userId)));
}

import { posts, revisions, user } from '@llf/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';

/**
 * Recent team activity for the notifications menu. Every publish writes a
 * revision with its author, so the first revision of a post is "published"
 * and later ones are "updated".
 */
export const getRecentActivity = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: revisions.id,
        postId: posts.id,
        title: posts.title,
        trashed: sql<boolean>`${posts.deletedAt} is not null`,
        actorId: revisions.createdBy,
        actor: user.name,
        at: revisions.createdAt,
        sequence: sql<number>`row_number() over (partition by ${revisions.entityId} order by ${revisions.createdAt})`,
      })
      .from(revisions)
      .innerJoin(posts, eq(posts.id, revisions.entityId))
      .leftJoin(user, eq(user.id, revisions.createdBy))
      .where(eq(revisions.entityType, 'post'))
      .orderBy(desc(revisions.createdAt))
      .limit(20);

    return rows.map((row) => ({
      id: row.id,
      postId: row.postId,
      title: row.title || 'Untitled',
      trashed: Boolean(row.trashed),
      actorId: row.actorId,
      actor: row.actor ?? 'Someone',
      action: Number(row.sequence) === 1 ? ('published' as const) : ('updated' as const),
      at: row.at.getTime(),
    }));
  });

export type ActivityItem = Awaited<ReturnType<typeof getRecentActivity>>[number];

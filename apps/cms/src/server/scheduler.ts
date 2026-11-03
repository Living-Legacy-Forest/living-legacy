import { publishErrors } from '@ll/content';
import { createDb } from '@ll/db';
import { posts } from '@ll/db/schema';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { liveInput, publishValues } from './post-store';

/**
 * Publishes every scheduled draft that is due. Called by the Worker's cron
 * trigger, so it takes the D1 binding directly rather than a request.
 * Each post is published on its own: one failure does not block the rest.
 */
export async function publishDuePosts(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const due = await db
    .select()
    .from(posts)
    .where(and(eq(posts.status, 'draft'), isNull(posts.deletedAt), lte(posts.scheduledAt, now)));

  const results = { published: 0, failed: 0 };
  for (const row of due) {
    try {
      const input = await liveInput(db, row);
      const errors = publishErrors(input);
      if (errors.length) {
        // Unschedule rather than retry forever; the post stays a draft.
        await db.update(posts).set({ scheduledAt: null }).where(eq(posts.id, row.id));
        console.error(`Scheduled post ${row.id} not published: ${errors.join(' ')}`);
        results.failed++;
        continue;
      }
      // Credited to whoever last saved it, which is who scheduled it.
      await publishValues(db, row, input, row.updatedBy);
      results.published++;
    } catch (error) {
      console.error(`Scheduled post ${row.id} failed to publish`, error);
      results.failed++;
    }
  }
  return results;
}

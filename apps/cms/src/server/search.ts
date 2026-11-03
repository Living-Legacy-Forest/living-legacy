import { posts, postTerms, terms } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';

const RESULT_LIMIT = 12;

/**
 * Global search for the command menu. Matches post titles, summaries and the
 * text inside post bodies (text nodes only, so structural words such as
 * "paragraph" never match), plus category names. An empty query returns the
 * most recently edited posts.
 */
export const searchContent = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ q: z.string().trim().max(100) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const pattern = `%${data.q.replace(/[\\%_]/g, '\\$&')}%`;
    const bodyMatch = sql`exists (select 1 from json_tree(${posts.body}) where key = 'text' and value like ${pattern} escape '\\')`;

    const postFields = {
      id: posts.id,
      title: posts.title,
      excerpt: posts.excerpt,
      status: posts.status,
      hasDraft: sql<boolean>`${posts.draft} is not null`,
      scheduledAt: posts.scheduledAt,
      updatedAt: posts.updatedAt,
      category: sql<
        string | null
      >`(select t.name from ${postTerms} pt join ${terms} t on t.id = pt.term_id where pt.post_id = ${posts.id} and t.type = 'category' order by t.name limit 1)`,
      // First body line containing the query, shown as context under the title.
      snippet: data.q
        ? sql<
            string | null
          >`(select value from json_tree(${posts.body}) where key = 'text' and value like ${pattern} escape '\\' limit 1)`
        : sql<null>`null`,
    };

    const postRows = data.q
      ? await db
          .select(postFields)
          .from(posts)
          .where(
            and(
              isNull(posts.deletedAt),
              or(
                sql`${posts.title} like ${pattern} escape '\\'`,
                sql`${posts.excerpt} like ${pattern} escape '\\'`,
                bodyMatch
              )
            )
          )
          // Title matches first, then the most recently edited.
          .orderBy(sql`${posts.title} like ${pattern} escape '\\' desc`, desc(posts.updatedAt))
          .limit(RESULT_LIMIT)
      : await db
          .select(postFields)
          .from(posts)
          .where(isNull(posts.deletedAt))
          .orderBy(desc(posts.updatedAt))
          .limit(6);

    const categories = data.q
      ? await db
          .select({
            id: terms.id,
            name: terms.name,
            posts: sql<number>`(select count(*) from ${postTerms} pt where pt.term_id = ${terms.id})`,
          })
          .from(terms)
          .where(and(eq(terms.type, 'category'), sql`${terms.name} like ${pattern} escape '\\'`))
          .orderBy(asc(terms.name))
          .limit(5)
      : [];

    return {
      query: data.q,
      posts: postRows.map((row) => ({
        ...row,
        hasDraft: Boolean(row.hasDraft),
        scheduledAt: row.scheduledAt?.getTime() ?? null,
        updatedAt: row.updatedAt.getTime(),
      })),
      categories: categories.map((c) => ({ ...c, posts: Number(c.posts) })),
    };
  });

export type SearchResults = Awaited<ReturnType<typeof searchContent>>;

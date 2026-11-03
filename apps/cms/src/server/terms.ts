import { slugify } from '@llf/content';
import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, count, eq, inArray, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { terms, postTerms, posts } = schema;

const typeSchema = z.object({ type: z.enum(['category', 'tag']) });

export const listTerms = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(typeSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: terms.id,
        name: terms.name,
        slug: terms.slug,
        description: terms.description,
        postCount: count(posts.id),
      })
      .from(terms)
      .leftJoin(postTerms, eq(postTerms.termId, terms.id))
      .leftJoin(posts, and(eq(posts.id, postTerms.postId), isNull(posts.deletedAt)))
      .where(eq(terms.type, data.type))
      .groupBy(terms.id)
      .orderBy(asc(terms.name));
    return rows.map((r) => ({ ...r, description: r.description ?? '' }));
  });

export type TermsData = Awaited<ReturnType<typeof listTerms>>;
export type Term = TermsData[number];

const saveSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['category', 'tag']),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300),
});

export const saveTerm = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(saveSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const slug = slugify(data.name);
    const noun = data.type === 'category' ? 'category' : 'tag';
    if (!slug) throw new Error(`Use letters or numbers in the ${noun} name.`);
    const existing = await db.query.terms.findFirst({
      where: and(
        eq(terms.type, data.type),
        eq(terms.slug, slug),
        data.id ? ne(terms.id, data.id) : undefined
      ),
    });
    if (existing) throw new Error(`A ${noun} named "${existing.name}" already exists.`);

    const values = {
      type: data.type,
      name: data.name,
      slug,
      description: data.description || null,
    };
    if (!data.id) {
      const [row] = await db.insert(terms).values(values).returning({ id: terms.id });
      if (!row) throw new Error(`Could not create the ${noun}.`);
      return { id: row.id };
    }
    await db
      .update(terms)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(terms.id, data.id));
    return { id: data.id };
  });

export const deleteTerms = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ type: z.enum(['category', 'tag']), ids: z.array(z.string()).min(1).max(200) }))
  .handler(async ({ data }) => {
    await getDb()
      .delete(terms)
      .where(and(eq(terms.type, data.type), inArray(terms.id, data.ids)));
    return { removed: data.ids.length };
  });

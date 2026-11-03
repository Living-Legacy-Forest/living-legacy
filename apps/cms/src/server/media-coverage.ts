import { mediaCoverageKinds, slugify } from '@ll/content';
import { mediaCoverage } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

export const listMediaCoverage = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb()
      .select({
        id: mediaCoverage.id,
        title: mediaCoverage.title,
        slug: mediaCoverage.slug,
        kind: mediaCoverage.kind,
        category: mediaCoverage.category,
        source: mediaCoverage.source,
        coverageDate: mediaCoverage.coverageDate,
        excerpt: mediaCoverage.excerpt,
        readingMinutes: mediaCoverage.readingMinutes,
        imageMediaId: mediaCoverage.imageMediaId,
        externalUrl: mediaCoverage.externalUrl,
        featured: mediaCoverage.featured,
        sortOrder: mediaCoverage.sortOrder,
        status: mediaCoverage.status,
      })
      .from(mediaCoverage)
      .where(isNull(mediaCoverage.deletedAt))
      // The order the website shows them in.
      .orderBy(
        desc(mediaCoverage.featured),
        asc(mediaCoverage.sortOrder),
        desc(mediaCoverage.coverageDate)
      );
    return rows.map((r) => ({ ...r, coverageDate: r.coverageDate?.getTime() ?? null }));
  });

export type MediaCoverageData = Awaited<ReturnType<typeof listMediaCoverage>>;
export type MediaCoverageItem = MediaCoverageData[number];

const coverageSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  /** Blank is made from the title. */
  slug: z.string().trim().max(80),
  kind: z.enum(mediaCoverageKinds),
  category: z.string().trim().max(40),
  source: z.string().trim().min(1).max(80),
  coverageDate: z.number().int().nullable(),
  excerpt: z.string().trim().max(400),
  readingMinutes: z.number().int().min(1).max(240).nullable(),
  imageMediaId: z.string().nullable(),
  externalUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//.test(u), 'Use a web link starting with https://'),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  status: z.enum(['draft', 'published']),
});

/** Appends -2, -3, ... until no other item uses the slug. */
async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || 'coverage';
  const taken = new Set(
    (
      await getDb()
        .select({ slug: mediaCoverage.slug })
        .from(mediaCoverage)
        .where(
          and(
            isNull(mediaCoverage.deletedAt),
            excludeId ? ne(mediaCoverage.id, excludeId) : undefined
          )
        )
    ).map((r) => r.slug)
  );
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not find a free slug. Try a different one.');
}

export const saveMediaCoverage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(coverageSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const now = new Date();
    const values = {
      title: data.title,
      slug: await uniqueSlug(data.slug || data.title, data.id),
      kind: data.kind,
      category: data.category || null,
      source: data.source,
      coverageDate: data.coverageDate === null ? null : new Date(data.coverageDate),
      excerpt: data.excerpt || null,
      readingMinutes: data.readingMinutes,
      imageMediaId: data.imageMediaId,
      externalUrl: data.externalUrl,
      featured: data.featured,
      sortOrder: data.sortOrder,
      status: data.status,
    };

    if (!data.id) {
      const [row] = await db
        .insert(mediaCoverage)
        .values({
          ...values,
          publishedAt: data.status === 'published' ? now : null,
          createdBy: context.user.id,
          updatedBy: context.user.id,
        })
        .returning({ id: mediaCoverage.id });
      return { id: row!.id };
    }

    const existing = await db.query.mediaCoverage.findFirst({
      where: eq(mediaCoverage.id, data.id),
    });
    if (!existing) throw new Error('This item no longer exists.');
    await db
      .update(mediaCoverage)
      .set({
        ...values,
        publishedAt: data.status === 'published' ? (existing.publishedAt ?? now) : null,
        updatedAt: now,
        updatedBy: context.user.id,
      })
      .where(eq(mediaCoverage.id, data.id));
    return { id: data.id };
  });

export const deleteMediaCoverage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await getDb().delete(mediaCoverage).where(inArray(mediaCoverage.id, data.ids));
    return { removed: data.ids.length };
  });

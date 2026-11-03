import { MAX_FAQ_TAGS, slugify, toTags } from '@ll/content';
import { faqGroups, faqs } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type BulkResult, firstIssue } from '@/lib/bulk-import';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

export const listFaqs = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = getDb();
    const [groups, rows] = await Promise.all([
      db
        .select({
          id: faqGroups.id,
          name: faqGroups.name,
          navLabel: faqGroups.navLabel,
          slug: faqGroups.slug,
          sortOrder: faqGroups.sortOrder,
        })
        .from(faqGroups)
        .orderBy(asc(faqGroups.sortOrder), asc(faqGroups.name)),
      db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          groupId: faqs.groupId,
          tags: faqs.tags,
          status: faqs.status,
          sortOrder: faqs.sortOrder,
        })
        .from(faqs)
        .where(isNull(faqs.deletedAt))
        .orderBy(asc(faqs.sortOrder), asc(faqs.question)),
    ]);
    return {
      groups,
      faqs: rows.map((r) => ({ ...r, answer: (r.answer?.text as string | undefined) ?? '' })),
    };
  });

export type FaqData = Awaited<ReturnType<typeof listFaqs>>;
export type FaqGroup = FaqData['groups'][number];
export type Faq = FaqData['faqs'][number];

const faqSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(2000),
  groupId: z.string().optional(),
  tags: z.array(z.string()).max(MAX_FAQ_TAGS).transform(toTags),
  status: z.enum(['draft', 'published']),
});

export const saveFaq = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(faqSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const now = new Date();
    const groupId = data.groupId || null;
    const answer = { type: 'text', text: data.answer };

    if (!data.id) {
      const [{ maxOrder } = { maxOrder: -1 }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${faqs.sortOrder}), -1)` })
        .from(faqs);
      const [row] = await db
        .insert(faqs)
        .values({
          question: data.question,
          answer,
          groupId,
          tags: data.tags,
          status: data.status,
          sortOrder: Number(maxOrder) + 1,
          publishedAt: data.status === 'published' ? now : null,
          createdBy: context.user.id,
          updatedBy: context.user.id,
        })
        .returning({ id: faqs.id });
      return { id: row!.id };
    }

    const existing = await db.query.faqs.findFirst({ where: eq(faqs.id, data.id) });
    await db
      .update(faqs)
      .set({
        question: data.question,
        answer,
        groupId,
        tags: data.tags,
        status: data.status,
        publishedAt: data.status === 'published' ? (existing?.publishedAt ?? now) : null,
        updatedAt: now,
        updatedBy: context.user.id,
      })
      .where(eq(faqs.id, data.id));
    return { id: data.id };
  });

export const deleteFaq = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(faqs).where(eq(faqs.id, data.id));
  });

export const moveFaq = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string(), direction: z.enum(['up', 'down']) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const target = await db.query.faqs.findFirst({ where: eq(faqs.id, data.id) });
    if (!target) return;

    // Only reorder within the same group (or within the ungrouped set).
    const siblings = await db
      .select({ id: faqs.id, sortOrder: faqs.sortOrder })
      .from(faqs)
      .where(
        target.groupId
          ? eq(faqs.groupId, target.groupId)
          : sql`${faqs.groupId} is null and ${faqs.deletedAt} is null`
      )
      .orderBy(asc(faqs.sortOrder), asc(faqs.question));

    const index = siblings.findIndex((f) => f.id === data.id);
    const swapWith = data.direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= siblings.length) return;

    const a = siblings[index]!;
    const b = siblings[swapWith]!;
    const now = new Date();
    await Promise.all([
      db.update(faqs).set({ sortOrder: b.sortOrder, updatedAt: now }).where(eq(faqs.id, a.id)),
      db.update(faqs).set({ sortOrder: a.sortOrder, updatedAt: now }).where(eq(faqs.id, b.id)),
    ]);
  });

const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  navLabel: z.string().trim().max(40).optional(),
  /** Blank is made from the name. */
  slug: z.string().trim().max(60).optional(),
});

export const saveFaqGroup = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(groupSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const values = {
      name: data.name,
      navLabel: data.navLabel || null,
      slug: slugify(data.slug || data.name) || null,
    };
    if (!data.id) {
      const [{ maxOrder } = { maxOrder: -1 }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${faqGroups.sortOrder}), -1)` })
        .from(faqGroups);
      const [row] = await db
        .insert(faqGroups)
        .values({ ...values, sortOrder: Number(maxOrder) + 1 })
        .returning({ id: faqGroups.id });
      return { id: row!.id };
    }
    await db
      .update(faqGroups)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(faqGroups.id, data.id));
    return { id: data.id };
  });

export const deleteFaqGroup = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    // FAQs in this group fall back to ungrouped; the FK sets group_id null.
    await getDb().delete(faqGroups).where(eq(faqGroups.id, data.id));
  });

export const deleteFaqs = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await getDb().delete(faqs).where(inArray(faqs.id, data.ids));
    return { removed: data.ids.length };
  });

/**
 * Adds rows without an id and updates rows with one, from a CSV upload. The
 * group is given by name; a name that does not exist yet creates that group.
 */
export const importFaqs = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(
    z.object({
      rows: z
        .array(
          faqSchema
            .omit({ groupId: true })
            .extend({ row: z.number().int(), group: z.string(), status: z.string() })
        )
        .min(1)
        .max(500),
    })
  )
  .handler(async ({ data, context }): Promise<BulkResult> => {
    const db = getDb();
    const now = new Date();
    const [
      existingFaqs,
      groups,
      [{ maxOrder } = { maxOrder: -1 }],
      [{ maxGroupOrder } = { maxGroupOrder: -1 }],
    ] = await Promise.all([
      db
        .select({ id: faqs.id, publishedAt: faqs.publishedAt })
        .from(faqs)
        .where(isNull(faqs.deletedAt)),
      db.select({ id: faqGroups.id, name: faqGroups.name }).from(faqGroups),
      db.select({ maxOrder: sql<number>`coalesce(max(${faqs.sortOrder}), -1)` }).from(faqs),
      db
        .select({ maxGroupOrder: sql<number>`coalesce(max(${faqGroups.sortOrder}), -1)` })
        .from(faqGroups),
    ]);
    const existing = new Map(existingFaqs.map((f) => [f.id, f]));
    const groupIds = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g.id]));
    let nextOrder = Number(maxOrder) + 1;
    let nextGroupOrder = Number(maxGroupOrder) + 1;

    async function groupIdFor(name: string): Promise<string | null> {
      const key = name.trim().toLowerCase();
      if (!key) return null;
      const known = groupIds.get(key);
      if (known) return known;
      const [row] = await db
        .insert(faqGroups)
        .values({ name: name.trim(), sortOrder: nextGroupOrder++ })
        .returning({ id: faqGroups.id });
      groupIds.set(key, row!.id);
      return row!.id;
    }

    const result: BulkResult = { added: 0, updated: 0, skipped: [] };
    for (const { row, group, ...input } of data.rows) {
      const parsed = faqSchema.safeParse(input);
      if (!parsed.success) {
        result.skipped.push({ row, reason: firstIssue(parsed.error) });
        continue;
      }
      if (group.trim().length > 80) {
        result.skipped.push({ row, reason: 'The group name is over 80 characters.' });
        continue;
      }
      const faq = parsed.data;
      const current = faq.id ? existing.get(faq.id) : undefined;
      if (faq.id && !current) {
        result.skipped.push({ row, reason: 'No FAQ has this id.' });
        continue;
      }
      const values = {
        question: faq.question,
        answer: { type: 'text', text: faq.answer },
        groupId: await groupIdFor(group),
        tags: faq.tags,
        status: faq.status,
        updatedBy: context.user.id,
      };

      if (current) {
        await db
          .update(faqs)
          .set({
            ...values,
            publishedAt: faq.status === 'published' ? (current.publishedAt ?? now) : null,
            updatedAt: now,
          })
          .where(eq(faqs.id, current.id));
        result.updated++;
      } else {
        await db.insert(faqs).values({
          ...values,
          sortOrder: nextOrder++,
          publishedAt: faq.status === 'published' ? now : null,
          createdBy: context.user.id,
        });
        result.added++;
      }
    }
    return result;
  });

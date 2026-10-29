import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { faqs, faqGroups } = schema;

export const listFaqs = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = getDb();
    const [groups, rows] = await Promise.all([
      db
        .select({ id: faqGroups.id, name: faqGroups.name, sortOrder: faqGroups.sortOrder })
        .from(faqGroups)
        .orderBy(asc(faqGroups.sortOrder), asc(faqGroups.name)),
      db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          groupId: faqs.groupId,
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

const groupSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(80) });

export const saveFaqGroup = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(groupSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    if (!data.id) {
      const [{ maxOrder } = { maxOrder: -1 }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${faqGroups.sortOrder}), -1)` })
        .from(faqGroups);
      const [row] = await db
        .insert(faqGroups)
        .values({ name: data.name, sortOrder: Number(maxOrder) + 1 })
        .returning({ id: faqGroups.id });
      return { id: row!.id };
    }
    await db
      .update(faqGroups)
      .set({ name: data.name, updatedAt: new Date() })
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

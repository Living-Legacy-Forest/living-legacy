import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type BulkResult, firstIssue } from '@/lib/bulk-import';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { teamMembers } = schema;

export const listTeamMembers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb()
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        role: teamMembers.role,
        bio: teamMembers.bio,
        status: teamMembers.status,
        photoMediaId: teamMembers.photoMediaId,
        sortOrder: teamMembers.sortOrder,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .where(isNull(teamMembers.deletedAt))
      .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name));
    return rows.map((r) => ({
      ...r,
      bio: (r.bio?.text as string | undefined) ?? '',
      createdAt: r.createdAt.getTime(),
    }));
  });

export type TeamListData = Awaited<ReturnType<typeof listTeamMembers>>;
export type TeamMember = TeamListData[number];

const memberSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'published']),
  /** Left out (as in a CSV import) keeps the current photo; null removes it. */
  photoMediaId: z.string().nullable().optional(),
});

export const saveTeamMember = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(memberSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const now = new Date();
    const role = data.role || null;
    const bio = data.bio ? { type: 'text', text: data.bio } : null;

    if (!data.id) {
      const [{ maxOrder } = { maxOrder: -1 }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${teamMembers.sortOrder}), -1)` })
        .from(teamMembers);
      const [row] = await db
        .insert(teamMembers)
        .values({
          name: data.name,
          role,
          bio,
          status: data.status,
          photoMediaId: data.photoMediaId ?? null,
          sortOrder: Number(maxOrder) + 1,
          publishedAt: data.status === 'published' ? now : null,
          createdBy: context.user.id,
          updatedBy: context.user.id,
        })
        .returning({ id: teamMembers.id });
      return { id: row!.id };
    }

    const existing = await db.query.teamMembers.findFirst({ where: eq(teamMembers.id, data.id) });
    await db
      .update(teamMembers)
      .set({
        name: data.name,
        role,
        bio,
        status: data.status,
        ...(data.photoMediaId !== undefined && { photoMediaId: data.photoMediaId }),
        // Keep the original publish time if it was already live.
        publishedAt: data.status === 'published' ? (existing?.publishedAt ?? now) : null,
        updatedAt: now,
        updatedBy: context.user.id,
      })
      .where(eq(teamMembers.id, data.id));
    return { id: data.id };
  });

export const deleteTeamMember = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    // Posts by this author keep their content; author_id is set null by the FK.
    await getDb().delete(teamMembers).where(eq(teamMembers.id, data.id));
  });

export const moveTeamMember = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string(), direction: z.enum(['up', 'down']) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const members = await db
      .select({ id: teamMembers.id, sortOrder: teamMembers.sortOrder })
      .from(teamMembers)
      .where(isNull(teamMembers.deletedAt))
      .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name));

    const index = members.findIndex((m) => m.id === data.id);
    const swapWith = data.direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= members.length) return;

    const a = members[index]!;
    const b = members[swapWith]!;
    const now = new Date();
    await Promise.all([
      db
        .update(teamMembers)
        .set({ sortOrder: b.sortOrder, updatedAt: now })
        .where(eq(teamMembers.id, a.id)),
      db
        .update(teamMembers)
        .set({ sortOrder: a.sortOrder, updatedAt: now })
        .where(eq(teamMembers.id, b.id)),
    ]);
  });

export const deleteTeamMembers = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await getDb().delete(teamMembers).where(inArray(teamMembers.id, data.ids));
    return { removed: data.ids.length };
  });

/** Adds rows without an id and updates rows with one, from a CSV upload. */
export const importTeamMembers = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(
    z.object({
      rows: z
        .array(memberSchema.extend({ row: z.number().int(), status: z.string() }))
        .min(1)
        .max(500),
    })
  )
  .handler(async ({ data, context }): Promise<BulkResult> => {
    const db = getDb();
    const now = new Date();
    const existing = new Map(
      (
        await db
          .select({ id: teamMembers.id, publishedAt: teamMembers.publishedAt })
          .from(teamMembers)
          .where(isNull(teamMembers.deletedAt))
      ).map((m) => [m.id, m])
    );
    const [{ maxOrder } = { maxOrder: -1 }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${teamMembers.sortOrder}), -1)` })
      .from(teamMembers);
    let nextOrder = Number(maxOrder) + 1;

    const result: BulkResult = { added: 0, updated: 0, skipped: [] };
    for (const { row, ...input } of data.rows) {
      const parsed = memberSchema.safeParse(input);
      if (!parsed.success) {
        result.skipped.push({ row, reason: firstIssue(parsed.error) });
        continue;
      }
      const member = parsed.data;
      const values = {
        name: member.name,
        role: member.role || null,
        bio: member.bio ? { type: 'text', text: member.bio } : null,
        status: member.status,
        updatedBy: context.user.id,
      };

      if (member.id) {
        const current = existing.get(member.id);
        if (!current) {
          result.skipped.push({ row, reason: 'No team member has this id.' });
          continue;
        }
        await db
          .update(teamMembers)
          .set({
            ...values,
            publishedAt: member.status === 'published' ? (current.publishedAt ?? now) : null,
            updatedAt: now,
          })
          .where(eq(teamMembers.id, member.id));
        result.updated++;
      } else {
        await db.insert(teamMembers).values({
          ...values,
          sortOrder: nextOrder++,
          publishedAt: member.status === 'published' ? now : null,
          createdBy: context.user.id,
        });
        result.added++;
      }
    }
    return result;
  });

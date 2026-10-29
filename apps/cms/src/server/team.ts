import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
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

import { guardRemoval, guardRoleChange, normaliseEmail, roleSchema } from '@ll/content';
import { invitation, user } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { deleteOwnAvatar } from '@/lib/avatars';
import { getDb } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';

async function adminCount(db: ReturnType<typeof getDb>): Promise<number> {
  const [row] = await db.select({ n: count() }).from(user).where(eq(user.role, 'admin'));
  return Number(row?.n ?? 0);
}

export const listUsers = createServerFn({ method: 'GET' })
  .middleware([requirePermission('users:manage')])
  .handler(async ({ context }) => {
    const db = getDb();
    const [users, invitations, admins] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          imageAlt: user.imageAlt,
          role: user.role,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(desc(user.createdAt)),
      db
        .select({ email: invitation.email, role: invitation.role, createdAt: invitation.createdAt })
        .from(invitation)
        .orderBy(desc(invitation.createdAt)),
      adminCount(db),
    ]);

    return {
      currentUserId: context.user.id,
      adminCount: admins,
      users: users.map((u) => ({ ...u, createdAt: u.createdAt.getTime() })),
      invitations: invitations.map((i) => ({ ...i, createdAt: i.createdAt.getTime() })),
    };
  });

export type TeamData = Awaited<ReturnType<typeof listUsers>>;

export const inviteUser = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(z.object({ email: z.string().email(), role: roleSchema }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const email = normaliseEmail(data.email);

    const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
    if (existing) throw new Error('That email already has an account.');

    await db
      .insert(invitation)
      .values({ email, role: data.role, invitedBy: context.user.id, createdAt: new Date() })
      .onConflictDoUpdate({
        target: invitation.email,
        set: { role: data.role, invitedBy: context.user.id },
      });

    // A failed email must not lose the invitation; the admin can resend it.
    let emailed = true;
    try {
      await sendInviteEmail(email, `${env.BETTER_AUTH_URL}/login`, data.role);
    } catch {
      emailed = false;
    }
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'user.invited',
      summary: `Invited ${email} as ${data.role}`,
    });
    return { email, emailed };
  });

export const changeUserRole = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(z.object({ userId: z.string(), role: roleSchema }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const target = await db.query.user.findFirst({ where: eq(user.id, data.userId) });
    if (!target) throw new Error('That user no longer exists.');

    const error = guardRoleChange({
      isSelf: target.id === context.user.id,
      targetIsLastAdmin: target.role === 'admin' && (await adminCount(db)) === 1,
      newRole: data.role,
    });
    if (error) throw new Error(error);

    await db
      .update(user)
      .set({ role: data.role, updatedAt: new Date() })
      .where(eq(user.id, target.id));
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'user.role_changed',
      summary: `Changed ${target.name}'s role from ${target.role} to ${data.role}`,
    });
  });

/**
 * A user's photo description, or removing the photo. Uploading one goes
 * through /api/avatar, which takes multipart form data.
 */
export const updateUserPhoto = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(
    z.object({
      userId: z.string(),
      imageAlt: z.string().trim().max(300).optional(),
      remove: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    const target = await db.query.user.findFirst({ where: eq(user.id, data.userId) });
    if (!target) throw new Error('That user no longer exists.');

    if (data.remove) {
      await deleteOwnAvatar(target.image, target.id);
      await db
        .update(user)
        .set({ image: null, imageAlt: null, updatedAt: new Date() })
        .where(eq(user.id, target.id));
      await logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'user.photo_changed',
        summary: `Removed ${target.name}'s photo`,
      });
      return;
    }
    if (data.imageAlt !== undefined) {
      await db
        .update(user)
        .set({ imageAlt: data.imageAlt || null, updatedAt: new Date() })
        .where(eq(user.id, target.id));
    }
  });

export const removeUser = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const target = await db.query.user.findFirst({ where: eq(user.id, data.userId) });
    if (!target) return;

    const error = guardRemoval({
      isSelf: target.id === context.user.id,
      targetIsLastAdmin: target.role === 'admin' && (await adminCount(db)) === 1,
    });
    if (error) throw new Error(error);

    // Sessions and accounts cascade-delete with the user.
    await db.delete(user).where(eq(user.id, target.id));
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'user.removed',
      summary: `Removed ${target.name} (${target.email})`,
    });
  });

export const revokeInvitation = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(z.object({ email: z.string() }))
  .handler(async ({ data }) => {
    await getDb()
      .delete(invitation)
      .where(eq(invitation.email, normaliseEmail(data.email)));
  });

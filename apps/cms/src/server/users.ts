import {
  guardRemoval,
  guardRoleChange,
  isEmailDomainAllowed,
  normaliseEmail,
  parseEmailDomains,
  roleSchema,
} from '@ll/content';
import { invitation, session, user } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { count, desc, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { deleteOwnAvatar } from '@/lib/avatars';
import { getDb } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';
import { readSiteSettings } from '@/lib/site-settings';
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
    const [users, invitations, activity] = await db.batch([
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
      // A session's updated_at moves when Better Auth refreshes it (about once
      // a day of use), so this is when someone was last around, to the day.
      // Expired sessions can be cleared, so no row means no recent sign-in.
      db
        .select({ userId: session.userId, at: max(session.updatedAt) })
        .from(session)
        .groupBy(session.userId),
    ]);
    const lastActive = new Map(
      activity.map((a) => [a.userId, a.at ? new Date(a.at).getTime() : null])
    );

    return {
      currentUserId: context.user.id,
      adminCount: users.filter((u) => u.role === 'admin').length,
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.getTime(),
        lastActiveAt: lastActive.get(u.id) ?? null,
      })),
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

    const { allowedEmailDomains } = await readSiteSettings();
    if (!isEmailDomainAllowed(email, allowedEmailDomains)) {
      const domains = parseEmailDomains(allowedEmailDomains).join(', ');
      throw new Error(`Invites can only go to ${domains} addresses. Change this in Settings.`);
    }

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

import {
  emailSchema,
  extraPermissionsSchema,
  guardExtraPermissionsChange,
  guardRemoval,
  guardRoleChange,
  isEmailDomainAllowed,
  normaliseEmail,
  parseEmailDomains,
  roleSchema,
} from '@ll/content';
import { invitation, user } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { deleteOwnAvatar } from '@/lib/avatars';
import { getDb } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';
import { readSiteSettings } from '@/lib/site-settings';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';
import {
  describePermissions,
  listTeamRows,
  saveInvitation,
  setUserExtraPermissions,
} from './user-store';

async function adminCount(db: ReturnType<typeof getDb>): Promise<number> {
  const [row] = await db.select({ n: count() }).from(user).where(eq(user.role, 'admin'));
  return Number(row?.n ?? 0);
}

export const listUsers = createServerFn({ method: 'GET' })
  .middleware([requirePermission('users:manage')])
  .handler(async ({ context }) => {
    const { users, invitations } = await listTeamRows(getDb());
    return {
      currentUserId: context.user.id,
      adminCount: users.filter((u) => u.role === 'admin').length,
      users,
      invitations,
    };
  });

export type TeamData = Awaited<ReturnType<typeof listUsers>>;

export const inviteUser = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(
    z.object({
      email: emailSchema(),
      role: roleSchema,
      extraPermissions: extraPermissionsSchema.default([]),
    })
  )
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

    await saveInvitation(db, {
      email,
      role: data.role,
      extraPermissions: data.extraPermissions,
      invitedBy: context.user.id,
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
      summary: `Invited ${email} as ${data.role}${
        data.extraPermissions.length
          ? ` with extra access to ${describePermissions(data.extraPermissions)}`
          : ''
      }`,
    });
    return { email, emailed };
  });

export const setExtraPermissions = createServerFn({ method: 'POST' })
  .middleware([requirePermission('users:manage')])
  .validator(z.object({ userId: z.string(), extraPermissions: extraPermissionsSchema }))
  .handler(async ({ data, context }) => {
    // The Users screen hides this for yourself, but the server decides.
    const error = guardExtraPermissionsChange({ isSelf: data.userId === context.user.id });
    if (error) throw new Error(error);
    await setUserExtraPermissions(getDb(), data.userId, data.extraPermissions, context.user);
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
      /** Show this drawn avatar instead of a photo. */
      avatarSeed: z
        .string()
        .regex(/^[\w-]{1,64}$/, 'That avatar could not be used.')
        .optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    const target = await db.query.user.findFirst({ where: eq(user.id, data.userId) });
    if (!target) throw new Error('That user no longer exists.');

    if (data.avatarSeed) {
      await deleteOwnAvatar(target.image, target.id);
      await db
        .update(user)
        .set({ image: null, imageAlt: null, avatarSeed: data.avatarSeed, updatedAt: new Date() })
        .where(eq(user.id, target.id));
      await logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'user.photo_changed',
        summary: `Chose an avatar for ${target.name}`,
      });
      return;
    }
    if (data.remove) {
      await deleteOwnAvatar(target.image, target.id);
      await db
        .update(user)
        .set({ image: null, imageAlt: null, avatarSeed: null, updatedAt: new Date() })
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

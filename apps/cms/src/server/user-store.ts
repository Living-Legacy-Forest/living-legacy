// Database work for people and invitations, shared by the server functions and the
// integration tests.
import { type Permission, type Role, parseExtraPermissions, permissionLabels } from '@ll/content';
import type { Db } from '@ll/db';
import { invitation, session, user } from '@ll/db/schema';
import { desc, eq, max } from 'drizzle-orm';
import { logActivity } from './activity-log';

export type Actor = { id: string; name: string };

/** Plain permission names for an activity summary; an empty list reads as "none". */
export const describePermissions = (list: readonly Permission[]) =>
  list.length ? list.map((permission) => permissionLabels[permission]).join(', ') : 'none';

export async function listTeamRows(db: Db) {
  const [users, invitations, activity] = await db.batch([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        imageAlt: user.imageAlt,
        avatarSeed: user.avatarSeed,
        role: user.role,
        extraPermissions: user.extraPermissions,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
    db
      .select({
        email: invitation.email,
        role: invitation.role,
        extraPermissions: invitation.extraPermissions,
        createdAt: invitation.createdAt,
      })
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

  // Parsed here so a malformed stored value reaches the screen as no extras.
  return {
    users: users.map((u) => ({
      ...u,
      extraPermissions: parseExtraPermissions(u.extraPermissions),
      createdAt: u.createdAt.getTime(),
      lastActiveAt: lastActive.get(u.id) ?? null,
    })),
    invitations: invitations.map((i) => ({
      ...i,
      extraPermissions: parseExtraPermissions(i.extraPermissions),
      createdAt: i.createdAt.getTime(),
    })),
  };
}

/** Re-inviting an email replaces its role and extras; extras are never merged. */
export async function saveInvitation(
  db: Db,
  invite: { email: string; role: Role; extraPermissions: Permission[]; invitedBy: string }
) {
  const extraPermissions = JSON.stringify(invite.extraPermissions);
  await db
    .insert(invitation)
    .values({
      email: invite.email,
      role: invite.role,
      extraPermissions,
      invitedBy: invite.invitedBy,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: invitation.email,
      set: { role: invite.role, extraPermissions, invitedBy: invite.invitedBy },
    });
}

export async function setUserExtraPermissions(
  db: Db,
  userId: string,
  extraPermissions: Permission[],
  actor: Actor
) {
  const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!target) throw new Error('That user no longer exists.');

  const before = parseExtraPermissions(target.extraPermissions);
  await db.batch([
    db
      .update(user)
      .set({ extraPermissions: JSON.stringify(extraPermissions), updatedAt: new Date() })
      .where(eq(user.id, target.id)),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.permissions_changed',
      summary: `Changed ${target.name || target.email}'s extra access from ${describePermissions(before)} to ${describePermissions(extraPermissions)}`,
    }),
  ]);
}

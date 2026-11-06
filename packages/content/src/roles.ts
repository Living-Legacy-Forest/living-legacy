import { z } from 'zod';

export const roles = ['admin', 'editor', 'author', 'seo', 'viewer'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const permissions = [
  // Write and edit posts, saved as drafts. Authors can only touch their own.
  'posts:write',
  // Publish, schedule, unpublish, trash and restore posts, and edit anyone's.
  'posts:publish',
  // A post's SEO fields and the Search & sharing settings.
  'seo:write',
  // FAQs, testimonials, team, announcements and post categories.
  'content:write',
  // Events and their guest lists (names, emails, phone numbers).
  'events:manage',
  'media:write',
  // Permanent delete, from the trash or of media.
  'content:purge',
  'redirects:write',
  'settings:write',
  'users:manage',
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<Role, readonly Permission[]> = {
  admin: permissions,
  editor: [
    'posts:write',
    'posts:publish',
    'seo:write',
    'content:write',
    'media:write',
    'events:manage',
  ],
  author: ['posts:write', 'media:write'],
  seo: ['seo:write', 'redirects:write'],
  // Read-only: sees the content pages, changes nothing.
  viewer: [],
};

export function can(role: Role, permission: Permission): boolean {
  return grants[role].includes(permission);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Decides whether a first-time Google sign-in may create an account, and with
 * which role. Bootstrap admins (from env) always win over an invitation so the
 * first admin can never be locked out. Returns null to refuse the sign-up.
 */
export function resolveSignupRole(
  email: string,
  options: { bootstrapAdminEmails?: string; invitedRole?: Role | null }
): Role | null {
  const bootstrap = (options.bootstrapAdminEmails ?? '')
    .split(',')
    .map(normaliseEmail)
    .filter(Boolean);
  if (bootstrap.includes(normaliseEmail(email))) return 'admin';
  return options.invitedRole ?? null;
}

/**
 * Invite-only policy for magic links: send one only to an email that already
 * has an account or is eligible to create one (invited or bootstrap). A
 * stranger gets nothing, so a link request never reveals who has access.
 */
export function canReceiveMagicLink(opts: {
  hasAccount: boolean;
  signupRole: Role | null;
}): boolean {
  return opts.hasAccount || opts.signupRole !== null;
}

/**
 * Guards a role change so an admin can neither change their own role nor leave
 * the CMS with no admin. Returns an error message, or null if the change is ok.
 */
export function guardRoleChange(opts: {
  isSelf: boolean;
  targetIsLastAdmin: boolean;
  newRole: Role;
}): string | null {
  if (opts.isSelf) return 'You cannot change your own role.';
  if (opts.targetIsLastAdmin && opts.newRole !== 'admin') {
    return 'There must be at least one admin.';
  }
  return null;
}

/** Guards removal so you cannot remove yourself or the last admin. */
export function guardRemoval(opts: { isSelf: boolean; targetIsLastAdmin: boolean }): string | null {
  if (opts.isSelf) return 'You cannot remove yourself.';
  if (opts.targetIsLastAdmin) return 'There must be at least one admin.';
  return null;
}

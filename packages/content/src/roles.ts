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
  'legal:publish',
  // Search and replace across all content at once. Admins only.
  'content:replace',
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

/** What a person may do: their role, plus anything an admin added for them alone. */
export type Access = { role: Role; extraPermissions?: readonly Permission[] };

// Handing out user management would let someone promote themselves, so it stays with admins.
export const grantablePermissions: readonly Permission[] = permissions.filter(
  (permission) => permission !== 'users:manage'
);

const grantable = new Set<string>(grantablePermissions);

function isGrantable(value: unknown): value is Permission {
  return typeof value === 'string' && grantable.has(value);
}

/**
 * Reads extras from the database column or a request. Never throws: a corrupt
 * value must cost someone their extras, not lock them out of the CMS.
 */
export function parseExtraPermissions(stored: unknown): Permission[] {
  let value = stored;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isGrantable))];
}

/**
 * A permission that does nothing on its own: the screen it opens, or the save behind it, is
 * guarded by another permission. Applied when extras are stored and in the checklist, never
 * inside `can`, so a role's own permissions are read exactly as listed.
 */
export const permissionRequires: Partial<Record<Permission, Permission>> = {
  // The editor shows Save, and `savePost` refuses it without write.
  'posts:publish': 'posts:write',
  // Legal review requests link to the legal editor, which needs content:write.
  'legal:publish': 'content:write',
  // The Settings screen and its save are guarded by seo:write.
  'settings:write': 'seo:write',
};

/** The extras with whatever they need added, once each, in the order of the permission list. */
export function withRequiredPermissions(extras: readonly Permission[]): Permission[] {
  const wanted = new Set(extras);
  for (const permission of extras) {
    const required = permissionRequires[permission];
    if (required) wanted.add(required);
  }
  return permissions.filter((permission) => wanted.has(permission));
}

export const extraPermissionsSchema: z.ZodType<Permission[]> = z
  .array(
    z.string().refine(isGrantable, {
      message: 'Choose from the permissions that can be added.',
    })
  )
  .transform((names) => withRequiredPermissions(names as Permission[]));

/** Reads a person's access from a database row or session user; an unknown role is a viewer. */
export function toAccess(row: { role?: string | null; extraPermissions?: string | null }): Access {
  const parsed = roleSchema.safeParse(row.role);
  return {
    role: parsed.success ? parsed.data : 'viewer',
    extraPermissions: parseExtraPermissions(row.extraPermissions),
  };
}

export function can(access: Access, permission: Permission): boolean {
  if (grants[access.role].includes(permission)) return true;
  // Re-filtered so a hand-built Access cannot grant users:manage.
  return isGrantable(permission) && (access.extraPermissions ?? []).includes(permission);
}

/** The roles that carry a permission by default. */
export function rolesGranting(permission: Permission): Role[] {
  return roles.filter((role) => grants[role].includes(permission));
}

export function permissionsFor(access: Access): Permission[] {
  return permissions.filter((permission) => can(access, permission));
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

/** Changing your own access would let an admin quietly widen it, so it stays with someone else. */
export function guardExtraPermissionsChange(opts: { isSelf: boolean }): string | null {
  return opts.isSelf ? 'You cannot change your own access.' : null;
}

/** Guards removal so you cannot remove yourself or the last admin. */
export function guardRemoval(opts: { isSelf: boolean; targetIsLastAdmin: boolean }): string | null {
  if (opts.isSelf) return 'You cannot remove yourself.';
  if (opts.targetIsLastAdmin) return 'There must be at least one admin.';
  return null;
}

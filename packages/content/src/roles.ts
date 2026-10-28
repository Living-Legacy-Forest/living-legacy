import { z } from 'zod';

export const roles = ['admin', 'editor'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const permissions = [
  // Posts, terms, FAQs, testimonials, team: create, edit, publish, trash, restore.
  'content:write',
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
  editor: ['content:write', 'media:write'],
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

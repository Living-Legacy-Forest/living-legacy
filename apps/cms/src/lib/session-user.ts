// Turns the session's raw user into what the CMS passes around. Kept apart from session.ts,
// which pulls in the Workers runtime, so it runs under plain Node tests.
import {
  type Permission,
  type Role,
  isSuperAdmin,
  parseExtraPermissions,
  toAccess,
} from '@ll/content';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  imageAlt: string | null;
  bio: string | null;
  /** A chosen drawn avatar, shown when there is no photo. */
  avatarSeed: string | null;
  role: Role;
  /** Permissions an admin gave this person on top of their role. */
  extraPermissions: Permission[];
  /** An admin on the BOOTSTRAP_ADMIN_EMAILS list: the only people who may remove users, clear the log or reset the assistant. */
  isSuperAdmin: boolean;
  /** When the account was made, so What's new skips what came before. */
  createdAt: number;
};

/** The session user as Better Auth hands it over: the extra columns are loosely typed. */
export type RawSessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  imageAlt?: unknown;
  bio?: unknown;
  avatarSeed?: unknown;
  role?: unknown;
  extraPermissions?: unknown;
  createdAt: Date | string | number;
};

const text = (value: unknown) => (typeof value === 'string' ? value : null);

export function toSessionUser(raw: RawSessionUser, bootstrapAdminEmails?: string): SessionUser {
  // An unknown role is a viewer and malformed extras are none: neither may lock anyone out.
  const { role } = toAccess({ role: text(raw.role) });
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    image: raw.image ?? null,
    imageAlt: text(raw.imageAlt),
    bio: text(raw.bio),
    avatarSeed: text(raw.avatarSeed),
    role,
    extraPermissions: parseExtraPermissions(raw.extraPermissions),
    isSuperAdmin: isSuperAdmin({ email: raw.email, role }, bootstrapAdminEmails),
    createdAt: new Date(raw.createdAt).getTime(),
  };
}

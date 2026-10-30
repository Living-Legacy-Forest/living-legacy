import { type Permission, type Role, can } from '@llf/content';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { getAuth } from './auth';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  bio: string | null;
  role: Role;
};

async function loadUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: getRequest().headers });
  if (!session) return null;
  const { id, name, email, image, bio, role } = session.user;
  return {
    id,
    name,
    email,
    image: image ?? null,
    bio: (bio as string | null) ?? null,
    role: role as Role,
  };
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(() => loadUser());

/**
 * The signed-in user as last seen by the browser, so changing pages does not wait
 * on a session check. Server functions still check the session on every call.
 */
let browserUser: SessionUser | undefined;

export async function getCachedUser() {
  if (browserUser) return browserUser;
  const user = await getCurrentUser();
  if (user && typeof window !== 'undefined') browserUser = user;
  return user;
}

export function forgetCachedUser() {
  browserUser = undefined;
}

/** Which sign-in methods the login page should offer. */
export const getLoginOptions = createServerFn({ method: 'GET' }).handler(() => ({
  google: Boolean(env.GOOGLE_CLIENT_ID),
}));

/** Every CMS server function goes through this: no session, no access. */
export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await loadUser();
  if (!user) throw new Error('You need to sign in.');
  return next({ context: { user } });
});

/** Server-side role check. The UI hiding a control is never the only guard. */
export function requirePermission(permission: Permission) {
  return createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(({ next, context }) => {
      if (!can(context.user.role, permission)) {
        throw new Error('You do not have permission to do that.');
      }
      return next();
    });
}

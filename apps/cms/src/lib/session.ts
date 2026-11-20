import { type Permission, can } from '@ll/content';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { getAuth } from './auth';
import { type SessionUser, toSessionUser } from './session-user';
import { readSiteSettings } from './site-settings';

export type { SessionUser } from './session-user';

/** `fresh` skips the session cookie cache, for when stale details would show. */
async function loadUser({ fresh = false } = {}): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({
    headers: getRequest().headers,
    query: { disableCookieCache: fresh },
  });
  if (!session) return null;
  return toSessionUser(session.user, env.BOOTSTRAP_ADMIN_EMAILS);
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(() =>
  loadUser({ fresh: true })
);

/**
 * The signed-in user as last seen by the browser, so changing pages does not wait
 * on a session check. Server functions still check the session on every call
 * (through the 5-minute session cookie cache).
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
export const getLoginOptions = createServerFn({ method: 'GET' }).handler(async () => ({
  google: Boolean(env.GOOGLE_CLIENT_ID) && (await readSiteSettings()).googleSignIn,
}));

/** Every CMS server function goes through this: no session, no access. */
export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await loadUser();
  if (!user) throw new Error('You need to sign in.');
  // Server errors from this request say whose and which role, by id only.
  // Loaded here, on the server, so the browser bundle never gets this SDK.
  const { getIsolationScope } = await import('@sentry/cloudflare');
  getIsolationScope().setUser({ id: user.id }).setTag('role', user.role);
  return next({ context: { user } });
});

/** Server-side role check. The UI hiding a control is never the only guard. */
/** For what even an admin may not do: removing people, clearing the log, resetting the assistant. */
export const requireSuperAdmin = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(({ next, context }) => {
    if (!context.user.isSuperAdmin) throw new Error('Only a super admin can do that.');
    return next();
  });

export function requirePermission(permission: Permission) {
  return createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(({ next, context }) => {
      if (!can(context.user, permission)) {
        throw new Error('You do not have permission to do that.');
      }
      return next();
    });
}

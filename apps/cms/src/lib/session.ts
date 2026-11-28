import { type Permission, can, parseBootstrapEmails } from '@ll/content';
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { getAuth } from './auth';
import { isLocalHost, takeDevLoginLink } from './dev-login';
import { type SessionUser, toSessionUser } from './session-user';
import { readSiteSettings } from './site-settings';
import { passkeysAllowed } from './passkeys';

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
/** Passkeys are on for this request: the live CMS only (lib/passkeys.ts). */
const passkeysOnHere = () =>
  passkeysAllowed({
    dev: import.meta.env.DEV,
    requestUrl: getRequest().url,
    authUrl: env.BETTER_AUTH_URL,
  });

export const getLoginOptions = createServerFn({ method: 'GET' }).handler(async () => ({
  google: Boolean(env.GOOGLE_CLIENT_ID) && (await readSiteSettings()).googleSignIn,
  passkeys: passkeysOnHere(),
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

/** Whether passkeys can be added and used here, for the profile and the add-a-passkey prompt. */
export const getPasskeysEnabled = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => passkeysOnHere());

/**
 * Local dev only: a sign-in link for the first bootstrap admin, so testing the CMS does not mean
 * digging a link out of the terminal. Refused unless this is `vite dev` and the request is for
 * localhost; a production build never contains it.
 */
export const getDevLoginLink = createServerFn({ method: 'POST' }).handler(async () => {
  if (!import.meta.env.DEV || !isLocalHost(getRequest().url)) {
    throw new Error('Dev sign-in is only available on localhost.');
  }
  const [email] = parseBootstrapEmails(env.BOOTSTRAP_ADMIN_EMAILS);
  if (!email) throw new Error('Add an address to BOOTSTRAP_ADMIN_EMAILS in .dev.vars first.');
  await getAuth().api.signInMagicLink({
    body: { email, callbackURL: '/' },
    headers: getRequest().headers,
  });
  const url = takeDevLoginLink(email);
  if (!url) throw new Error('No sign-in link was made. Check the terminal for why.');
  return { url };
});

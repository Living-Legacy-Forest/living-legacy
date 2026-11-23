import {
  canReceiveMagicLink,
  normaliseEmail,
  parseExtraPermissions,
  resolveSignupRole,
  sessionDayOptions,
} from '@ll/content';
import { passkey } from '@better-auth/passkey';
import { schema } from '@ll/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from 'cloudflare:workers';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import { logPasskeyChange } from '@/server/passkeys';
import { getDb } from './db';
import { sendChangeEmailVerificationEmail, sendMagicLinkEmail } from './email';
import { passkeysAllowed } from './passkeys';
import { readSiteSettings } from './site-settings';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a sign-in link works. */
const MAGIC_LINK_SECONDS = 300;
/** One sign-in email per address in this long; the earlier link still works. */
const MAGIC_LINK_COOLDOWN_SECONDS = 60;

/** When a session started or refreshed now should end, from Settings → Sign-in. */
async function sessionEnd(): Promise<Date> {
  const { sessionDays } = await readSiteSettings();
  const days = (sessionDayOptions as readonly number[]).includes(sessionDays) ? sessionDays : 7;
  return new Date(Date.now() + days * DAY_MS);
}

function createAuth() {
  const db = getDb();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        passkey: schema.passkey,
      },
    }),
    // Google is optional: enabled only when its credentials are configured.
    socialProviders: env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: 'select_account',
          },
        }
      : undefined,
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'editor', input: false },
        extraPermissions: { type: 'string', required: false, defaultValue: '[]', input: false },
        bio: { type: 'string', required: false },
        imageAlt: { type: 'string', required: false },
        theme: { type: 'string', required: false },
        // Written only by setMyAppearance, which validates it.
        appearance: { type: 'string', required: false, input: false },
        avatarSeed: { type: 'string', required: false },
        // Set only by the server functions that check the file is the caller's own.
        banner: { type: 'string', required: false, input: false },
      },
      // The new address must be confirmed before it takes effect: there is no
      // password, so the magic-link email itself is how identity is proven.
      changeEmail: { enabled: true },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendChangeEmailVerificationEmail(normaliseEmail(user.email), url);
      },
    },
    // Saves the session and user lookups on every server function call. The
    // tradeoff: removing a user or changing their role reaches their open
    // sessions only once this expires.
    //
    // The longest idle limit Settings offers; the session hooks below cut each
    // session to the one chosen. Better Auth judges a refresh against this, so
    // with a shorter limit an active session is saved again at most every
    // cookie-cache window, which keeps the limit sliding.
    session: { expiresIn: 30 * 24 * 60 * 60, cookieCache: { enabled: true, maxAge: 5 * 60 } },
    // Google sign-in can be switched off in Settings; refuse it on the server
    // too, not only by hiding the button.
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const google =
          (ctx.path === '/sign-in/social' && ctx.body?.provider === 'google') ||
          ctx.path === '/callback/:id';
        if (google && !(await readSiteSettings()).googleSignIn) {
          throw new APIError('FORBIDDEN', { message: 'google_disabled' });
        }
        // Passkeys are for the live CMS only (lib/passkeys.ts); elsewhere every passkey
        // request is refused, not only hidden.
        if (
          ctx.path.startsWith('/passkey/') &&
          !passkeysAllowed({
            dev: import.meta.env.DEV,
            requestUrl: ctx.request?.url ?? '',
            authUrl: env.BETTER_AUTH_URL,
          })
        ) {
          throw new APIError('FORBIDDEN', { message: 'passkeys_off' });
        }
      }),
      // Adding and removing a passkey go in the activity log, once the add-on has done it.
      after: createAuthMiddleware(async (ctx) => {
        const action =
          ctx.path === '/passkey/verify-registration'
            ? 'user.passkey_added'
            : ctx.path === '/passkey/delete-passkey'
              ? 'user.passkey_removed'
              : null;
        if (!action || ctx.context.returned instanceof Error) return;
        const user = (await getSessionFromCtx(ctx))?.user;
        if (!user) return;
        await logPasskeyChange(db, { id: user.id, name: user.name }, action);
      }),
    },
    // A refused sign-in lands back on the login page with ?error=...
    onAPIError: { errorURL: '/login' },
    // The rate limits (sign-in links and link checks, 5 a minute per caller) key on the caller's
    // IP. By default that is X-Forwarded-For, which a caller can set to anything, and with more
    // than one value in it no IP is found and everyone shares a single bucket. Cloudflare sets
    // CF-Connecting-IP itself and replaces any value sent, so it cannot be dodged.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({ data: { ...session, expiresAt: await sessionEnd() } }),
        },
        update: {
          // Only a refresh moves the expiry; other updates leave it alone.
          before: async (session) =>
            session.expiresAt ? { data: { ...session, expiresAt: await sessionEnd() } } : undefined,
        },
      },
      user: {
        create: {
          // Invite-only: refuse any Google account that is neither invited nor
          // a bootstrap admin.
          before: async (user) => {
            const email = normaliseEmail(user.email);
            const invite = await db.query.invitation.findFirst({
              where: eq(schema.invitation.email, email),
            });
            const role = resolveSignupRole(email, {
              bootstrapAdminEmails: env.BOOTSTRAP_ADMIN_EMAILS,
              invitedRole: invite?.role,
            });
            if (!role) {
              throw new APIError('FORBIDDEN', { message: 'not_invited' });
            }
            return {
              data: {
                ...user,
                email,
                role,
                extraPermissions: JSON.stringify(parseExtraPermissions(invite?.extraPermissions)),
              },
            };
          },
          // The invitation has been used. Removing it means a user an admin
          // later deletes cannot simply sign back in.
          after: async (user) => {
            await db.delete(schema.invitation).where(eq(schema.invitation.email, user.email));
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_SECONDS,
        storeToken: 'hashed', // a DB leak must not expose usable links
        rateLimit: { window: 60, max: 5 },
        sendMagicLink: async ({ email, url }) => {
          const normalised = normaliseEmail(email);
          const [existing, invite] = await Promise.all([
            db.query.user.findFirst({ where: eq(schema.user.email, normalised) }),
            db.query.invitation.findFirst({ where: eq(schema.invitation.email, normalised) }),
          ]);
          const signupRole = resolveSignupRole(normalised, {
            bootstrapAdminEmails: env.BOOTSTRAP_ADMIN_EMAILS,
            invitedRole: invite?.role,
          });
          // Invite-only: say nothing to strangers. The user-create hook is the
          // backstop if a link is ever used for a non-eligible email.
          if (!canReceiveMagicLink({ hasAccount: Boolean(existing), signupRole })) {
            // The page says "sent" either way, so this line is the only trace of why no email came.
            console.warn('[auth] sign-in link not sent: no account or invitation for this address');
            return;
          }
          // The rate limit above is per address the request came from, and only
          // within one Worker instance. This one is per inbox: a link already sent
          // in the last minute is still valid, so another email would only
          // flood the inbox and spend sending quota. This request's own link is
          // already stored, hence "more than one".
          const [recent] = await db
            .select({ n: count() })
            .from(schema.verification)
            .where(
              and(
                sql`json_extract(${schema.verification.value}, '$.type') = 'magic-link'`,
                sql`lower(json_extract(${schema.verification.value}, '$.email')) = ${normalised}`,
                gt(
                  schema.verification.expiresAt,
                  new Date(Date.now() + (MAGIC_LINK_SECONDS - MAGIC_LINK_COOLDOWN_SECONDS) * 1000)
                )
              )
            );
          if ((recent?.n ?? 0) > 1) {
            console.warn('[auth] sign-in link not sent: one was already sent in the last minute');
            return;
          }
          await sendMagicLinkEmail(normalised, url);
        },
      }),
      passkey({
        // A passkey belongs to this address; the browser shows rpName in its prompt.
        rpID: new URL(env.BETTER_AUTH_URL).hostname,
        rpName: 'Living Legacy CMS',
        origin: new URL(env.BETTER_AUTH_URL).origin,
      }),
      tanstackStartCookies(),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}

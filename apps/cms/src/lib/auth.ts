import { canReceiveMagicLink, normaliseEmail, resolveSignupRole } from '@llf/content';
import { schema } from '@llf/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { magicLink } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { sendMagicLinkEmail } from './email';

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
      },
    },
    // A refused sign-in lands back on the login page with ?error=...
    onAPIError: { errorURL: '/login' },
    databaseHooks: {
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
            return { data: { ...user, email, role } };
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
        expiresIn: 300, // 5 minutes
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
          if (!canReceiveMagicLink({ hasAccount: Boolean(existing), signupRole })) return;
          await sendMagicLinkEmail(normalised, url);
        },
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

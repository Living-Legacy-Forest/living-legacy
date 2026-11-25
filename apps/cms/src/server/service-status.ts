import { apiKeys } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { count, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { emailConfigured } from '@/lib/email';
import { requirePermission } from '@/lib/session';
import { heartbeatCount } from './cron-jobs';

/**
 * Which outside services this deployment is connected to, for the Apps page. Each is a secret set
 * on the CMS Worker, so what leaves the server is yes or no: never a key, a token or an address.
 */
export const getServiceStatuses = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async () => {
    const [row] = await getDb()
      .select({ active: count() })
      .from(apiKeys)
      .where(isNull(apiKeys.revokedAt));
    return {
      /** HubSpot's private app token: event bookings sync to contacts once it is set. */
      hubspot: Boolean(env.HUBSPOT_ACCESS_TOKEN),
      /** Whichever service sends the sign-in links (EMAIL_PROVIDER). */
      email: emailConfigured(),
      googleSignIn: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      /** Anthropic, for the Suggest buttons. */
      assistant: Boolean(env.ANTHROPIC_API_KEY),
      /** PostHog's personal key and project, for the page-view charts. */
      posthogReports: Boolean(env.POSTHOG_PERSONAL_API_KEY && env.POSTHOG_PROJECT_ID),
      /** Better Stack's read-only token, for the Uptime page. */
      uptime: Boolean(env.BETTERSTACK_API_TOKEN),
      heartbeats: heartbeatCount(env) > 0,
      /** Sentry reports only from the production deploy. */
      sentry: import.meta.env.VITE_SENTRY_ENVIRONMENT === 'production',
      /** Active API keys, which is how Claude and other AI tools connect. */
      apiKeys: row?.active ?? 0,
    };
  });

export type ServiceStatuses = Awaited<ReturnType<typeof getServiceStatuses>>;

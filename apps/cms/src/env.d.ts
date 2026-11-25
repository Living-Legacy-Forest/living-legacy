// Secrets come from .dev.vars locally and `wrangler secret put` remotely, so
// `wrangler types` cannot see them. Declared here instead.
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    // Google sign-in is optional; absent unless configured.
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    BOOTSTRAP_ADMIN_EMAILS?: string;
    // HubSpot private app token; event bookings sync once it is set (server/event-crm.ts).
    HUBSPOT_ACCESS_TOKEN?: string;
    // Better Stack heartbeat addresses, one JSON object for all of them: keys are
    // schedules or jobs (server/cron-jobs.ts). Unset locally, where nothing is pinged.
    HEARTBEAT_URLS?: string;
    // Better Stack Uptime API token (read-only), for the Uptime page (server/uptime.ts).
    BETTERSTACK_API_TOKEN?: string;
  }
}

// Set in vite.config.ts; read through src/lib/build-info.ts.
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_COMMIT: string;
  readonly VITE_APP_BUILT_AT: string;
  // "production" for CI's deploy, "preview" for a pull request's version,
  // "development" for local builds. Sentry reports only from production.
  readonly VITE_SENTRY_ENVIRONMENT: string;
}

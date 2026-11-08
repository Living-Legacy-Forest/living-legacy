// Secrets come from .dev.vars locally and `wrangler secret put` remotely, so
// `wrangler types` cannot see them. Declared here instead.
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    // Google sign-in is optional; absent unless configured.
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    BOOTSTRAP_ADMIN_EMAILS?: string;
    // Resend. The key is absent in local dev, where links are logged instead.
    RESEND_API_KEY?: string;
    // HubSpot private app token; event bookings sync once it is set (server/event-crm.ts).
    HUBSPOT_ACCESS_TOKEN?: string;
  }
}

// Set in vite.config.ts; read through src/lib/build-info.ts.
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_COMMIT: string;
  readonly VITE_APP_BUILT_AT: string;
  // "preview" for a pull request's version, "production" otherwise.
  readonly VITE_SENTRY_ENVIRONMENT: string;
}

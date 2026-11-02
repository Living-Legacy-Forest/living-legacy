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
  }
}

// Set at build time in vite.config.ts; read through src/lib/build-info.ts.
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

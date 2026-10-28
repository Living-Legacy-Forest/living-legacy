// Secrets come from .dev.vars locally and `wrangler secret put` remotely, so
// `wrangler types` cannot see them. Declared here instead.
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    BOOTSTRAP_ADMIN_EMAILS?: string;
  }
}

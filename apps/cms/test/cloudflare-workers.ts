// Stands in for the `cloudflare:workers` module under Node (vitest.config.ts).
// Integration tests fill `env` with local bindings (integration-setup.ts);
// unit tests never reach for it.
export const env = {} as Cloudflare.Env;

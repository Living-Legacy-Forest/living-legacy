/// <reference types="astro/client" />

// Provided by the Workers runtime. Only the bindings the site reads are typed,
// in src/lib/redirects.ts, so no Workers type package is needed.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}

// Settings both Sentry SDKs share: the browser one (router.tsx) and the
// Worker one (server.ts). No Sentry import here, so neither side pulls in the
// other's SDK.

// Public by design: the browser bundle carries it too. It lets someone send
// events to the project, not read them.
const DSN =
  'https://280438d33e22448502e812c90ebfaf18@o4512395918311424.ingest.us.sentry.io/4512395952455680';

export const sentryOptions = {
  dsn: DSN,
  // Local dev stays quiet; only builds report.
  enabled: import.meta.env.PROD,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  release: import.meta.env.VITE_APP_COMMIT,
  // The CMS is small enough to trace everything.
  tracesSampleRate: 1.0,
  // Editors type names, emails and unpublished content into the CMS. Keep
  // request bodies and cookies (the session) out of Sentry.
  dataCollection: { httpBodies: [], cookies: false },
};

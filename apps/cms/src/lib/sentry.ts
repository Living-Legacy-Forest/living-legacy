// Settings both Sentry SDKs share: the browser one (router.tsx) and the
// Worker one (server.ts). No Sentry import here, so neither side pulls in the
// other's SDK.

// Public by design: the browser bundle carries it too. It lets someone send
// events to the project, not read them.
const DSN =
  'https://280438d33e22448502e812c90ebfaf18@o4512395918311424.ingest.us.sentry.io/4512395952455680';

export const sentryOptions = {
  dsn: DSN,
  // Production only: set in vite.config.ts.
  enabled: import.meta.env.PROD && import.meta.env.VITE_SENTRY_ENVIRONMENT === 'production',
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  release: import.meta.env.VITE_APP_COMMIT,
  // The CMS is small enough to trace everything.
  tracesSampleRate: 1.0,
  // Editors type names, emails and unpublished content into the CMS. Keep
  // request bodies and cookies (the session) out of Sentry.
  dataCollection: { httpBodies: [], cookies: false },
  // A tab still running the CMS from before a deploy calls server functions
  // that no longer exist. It is offered a reload (components/shell/updates.tsx), so this is
  // expected after every deploy, not a bug.
  ignoreErrors: [/Server function info not found/],
};

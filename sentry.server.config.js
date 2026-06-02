import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: 'REPLACE_WITH_YOUR_SENTRY_DSN',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

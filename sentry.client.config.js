import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: 'REPLACE_WITH_YOUR_SENTRY_DSN',
  integrations: [],
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],
});

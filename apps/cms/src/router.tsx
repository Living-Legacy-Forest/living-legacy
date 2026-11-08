import * as Sentry from '@sentry/tanstackstart-react';
import { createRouter } from '@tanstack/react-router';
import { sentryOptions } from './lib/sentry';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // The router's error boundary shows the error and swallows it; report it first.
    defaultOnCatch: (error) => Sentry.captureException(error),
  });

  // The Worker's Sentry is set up in server.ts.
  if (!router.isServer) {
    Sentry.init({
      ...sentryOptions,
      integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
    });
  }

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

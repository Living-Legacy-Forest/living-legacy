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
      integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        // "Report a problem" in the account menu opens this form (lib/report-problem.ts).
        // No name or email fields: reports carry the user's id, as errors do.
        Sentry.feedbackIntegration({
          autoInject: false,
          colorScheme: 'system',
          showBranding: false,
          showName: false,
          showEmail: false,
          isNameRequired: false,
          isEmailRequired: false,
          enableScreenshot: true,
          formTitle: 'Report a problem',
          messageLabel: 'What went wrong?',
          messagePlaceholder: 'What were you doing, and what happened instead?',
          submitButtonLabel: 'Send report',
          successMessageText: 'Thanks. Your report has been sent.',
        }),
      ],
    });
  }

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

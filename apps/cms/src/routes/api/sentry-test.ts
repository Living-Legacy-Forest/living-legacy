// TEMPORARY: proves server errors reach Sentry from the PR preview.
// Remove before merging.
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/sentry-test')({
  server: {
    handlers: {
      GET: () => {
        throw new Error('Sentry server test error');
      },
    },
  },
});

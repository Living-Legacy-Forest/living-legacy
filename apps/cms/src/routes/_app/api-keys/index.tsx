import { createFileRoute, redirect } from '@tanstack/react-router';

// API keys moved into Integrations; old bookmarks still land there.
export const Route = createFileRoute('/_app/api-keys/')({
  beforeLoad: () => {
    throw redirect({ to: '/integrations', replace: true });
  },
});

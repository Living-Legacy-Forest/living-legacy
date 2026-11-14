import { createFileRoute, redirect } from '@tanstack/react-router';

// Visitors moved under Analytics; old links and bookmarks still land on it.
export const Route = createFileRoute('/_app/visitors/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/analytics/visitors', search, replace: true });
  },
});

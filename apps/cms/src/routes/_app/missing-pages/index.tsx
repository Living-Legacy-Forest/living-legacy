import { createFileRoute, redirect } from '@tanstack/react-router';

// Missing pages moved into Redirects; this keeps old links and bookmarks working.
export const Route = createFileRoute('/_app/missing-pages/')({
  beforeLoad: () => {
    throw redirect({ to: '/redirects', search: { view: 'missing' }, replace: true });
  },
});

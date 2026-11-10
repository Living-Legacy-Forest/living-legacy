import { createFileRoute, redirect } from '@tanstack/react-router';

// The two legal pages are listed in Settings; this keeps old links and the
// editor's breadcrumb working.
export const Route = createFileRoute('/_app/legal/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', hash: 'legal' });
  },
});

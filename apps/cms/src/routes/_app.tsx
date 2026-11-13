import * as Sentry from '@sentry/tanstackstart-react';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getCachedUser } from '@/lib/session';
import { readListViews } from '@/lib/list-view';
import { readSidebarState } from '@/lib/sidebar-state';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getCachedUser();
    if (!user) throw redirect({ to: '/login' });
    return { user, sidebar: readSidebarState(), listViews: readListViews() };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, sidebar } = Route.useRouteContext();
  // Errors say whose session and which role, by id only: never a name or email.
  useEffect(() => {
    Sentry.setUser({ id: user.id });
    Sentry.setTag('role', user.role);
    return () => {
      Sentry.setUser(null);
      Sentry.setTag('role', undefined);
    };
  }, [user.id, user.role]);

  return (
    <AppShell user={user} sidebar={sidebar}>
      <Outlet />
    </AppShell>
  );
}

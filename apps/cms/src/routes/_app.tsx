import * as Sentry from '@sentry/tanstackstart-react';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getCachedAiAccess } from '@/lib/ai-status';
import { getCachedUser } from '@/lib/session';
import { readListViews } from '@/lib/list-view';
import { readNavPrefs } from '@/lib/nav-prefs-cookie';
import { readSidebarState } from '@/lib/sidebar-state';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getCachedUser();
    if (!user) throw redirect({ to: '/login' });
    const { enabled: ai, groups: aiGroups } = await getCachedAiAccess(user.id);
    return {
      user,
      ai,
      aiGroups,
      sidebar: readSidebarState(),
      navPrefs: readNavPrefs(),
      listViews: readListViews(),
    };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, sidebar, navPrefs } = Route.useRouteContext();
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
    <AppShell user={user} sidebar={sidebar} navPrefs={navPrefs}>
      <Outlet />
    </AppShell>
  );
}

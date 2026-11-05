import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/shell/app-shell';
import { getCachedUser } from '@/lib/session';
import { readSidebarState } from '@/lib/sidebar-state';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getCachedUser();
    if (!user) throw redirect({ to: '/login' });
    return { user, sidebar: readSidebarState() };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, sidebar } = Route.useRouteContext();

  return (
    <AppShell user={user} sidebar={sidebar}>
      <Outlet />
    </AppShell>
  );
}

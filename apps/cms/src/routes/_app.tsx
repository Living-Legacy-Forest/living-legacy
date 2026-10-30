import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/shell/app-shell';
import { getCachedUser } from '@/lib/session';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getCachedUser();
    if (!user) throw redirect({ to: '/login' });
    return { user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();

  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}

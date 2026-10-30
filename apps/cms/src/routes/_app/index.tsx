import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/dashboard';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { getDashboardData } from '@/server/dashboard';

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'Dashboard | Living Legacy CMS' }] }),
  loader: () => getDashboardData(),
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const firstName = user.name.split(' ')[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Welcome, {firstName}</h1>
      <Dashboard data={data} user={user} />
    </div>
  );
}

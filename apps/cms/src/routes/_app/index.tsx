import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/dashboard';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { RevealWords } from '@/components/dashboard/reveal-words';
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
      <h1 data-slot="page-title" className="text-2xl">
        <RevealWords text={`Welcome, ${firstName}`} />
      </h1>
      <Dashboard data={data} />
    </div>
  );
}

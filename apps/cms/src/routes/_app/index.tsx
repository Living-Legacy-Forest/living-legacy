import { createFileRoute, redirect } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/dashboard';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { launchRedirect } from '@/lib/home-page';
import { getDashboardData } from '@/server/dashboard';

export const Route = createFileRoute('/_app/')({
  // Opening the CMS lands on the page the site chose as its home, once a browser session.
  beforeLoad: async ({ context }) => {
    const to = await launchRedirect(context.user);
    if (to) throw redirect({ to });
  },
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

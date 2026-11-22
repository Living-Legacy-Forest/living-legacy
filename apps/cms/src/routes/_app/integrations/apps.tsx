import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppsPage } from '@/components/integrations/apps-page';
import { getServiceStatuses } from '@/server/service-status';
import { getTrackingIds } from '@/server/tracking';

export const Route = createFileRoute('/_app/integrations/apps')({
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: async () => {
    const [tracking, services] = await Promise.all([getTrackingIds(), getServiceStatuses()]);
    return { tracking, services };
  },
  head: () => ({ meta: [{ title: 'Apps | Living Legacy CMS' }] }),
  component: AppsRoute,
});

function AppsRoute() {
  const { tracking, services } = Route.useLoaderData();
  return <AppsPage tracking={tracking} services={services} />;
}

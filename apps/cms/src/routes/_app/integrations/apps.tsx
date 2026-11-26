import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppsPage } from '@/components/integrations/apps-page';
import { getServiceStatuses } from '@/server/service-status';
import { getSiteSettings } from '@/server/settings';
import { getTrackingIds } from '@/server/tracking';

export const Route = createFileRoute('/_app/integrations/apps')({
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: async () => {
    const [tracking, services, settings] = await Promise.all([
      getTrackingIds(),
      getServiceStatuses(),
      getSiteSettings(),
    ]);
    return { tracking, services, bookingConfirmations: settings.sendBookingConfirmations };
  },
  head: () => ({ meta: [{ title: 'Apps | Living Legacy CMS' }] }),
  component: AppsRoute,
});

function AppsRoute() {
  const { tracking, services, bookingConfirmations } = Route.useLoaderData();
  return (
    <AppsPage tracking={tracking} services={services} bookingConfirmations={bookingConfirmations} />
  );
}

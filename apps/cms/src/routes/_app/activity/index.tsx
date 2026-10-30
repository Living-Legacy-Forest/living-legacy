import { can } from '@llf/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ActivityPage } from '@/components/activity/activity-page';
import { listActivity } from '@/server/activity-log';

export const Route = createFileRoute('/_app/activity/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'posts:publish')) throw redirect({ to: '/' });
  },
  loader: () => listActivity(),
  head: () => ({ meta: [{ title: 'Activity | Living Legacy CMS' }] }),
  component: ActivityRoute,
});

function ActivityRoute() {
  const data = Route.useLoaderData();
  return <ActivityPage data={data} />;
}

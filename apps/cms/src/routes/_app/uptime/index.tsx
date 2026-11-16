import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { UptimePage } from '@/components/uptime/uptime-page';
import { getUptime } from '@/server/uptime';

export const Route = createFileRoute('/_app/uptime/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: () => getUptime(),
  head: () => ({ meta: [{ title: 'Uptime | Living Legacy CMS' }] }),
  component: UptimeRoute,
});

function UptimeRoute() {
  return <UptimePage data={Route.useLoaderData()} />;
}

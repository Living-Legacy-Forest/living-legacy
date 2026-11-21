import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { SystemPage } from '@/components/system/system-page';
import { getSystemStatus } from '@/server/system';

export const Route = createFileRoute('/_app/system/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: () => getSystemStatus(),
  head: () => ({ meta: [{ title: 'System | Living Legacy CMS' }] }),
  component: SystemRoute,
});

function SystemRoute() {
  const { user } = Route.useRouteContext();
  return <SystemPage data={Route.useLoaderData()} canResetAssistant={user.isSuperAdmin} />;
}

import { can } from '@llf/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { SettingsPage } from '@/components/settings/settings-page';
import { getSiteSettings } from '@/server/settings';

export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'settings:write')) throw redirect({ to: '/' });
  },
  loader: () => getSiteSettings(),
  head: () => ({ meta: [{ title: 'Settings | Living Legacy Forest CMS' }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const data = Route.useLoaderData();
  return <SettingsPage data={data} />;
}

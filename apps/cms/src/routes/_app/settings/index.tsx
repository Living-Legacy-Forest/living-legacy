import { createFileRoute } from '@tanstack/react-router';
import { SettingsIndex } from '@/components/settings/settings-index';

// Wide screens open the first page, since the sidebar already lists the rest; phones get the
// list itself, as iOS Settings does.
export const Route = createFileRoute('/_app/settings/')({
  head: () => ({ meta: [{ title: 'Settings | Living Legacy CMS' }] }),
  component: SettingsIndexRoute,
});

function SettingsIndexRoute() {
  const { user } = Route.useRouteContext();
  return <SettingsIndex user={user} />;
}

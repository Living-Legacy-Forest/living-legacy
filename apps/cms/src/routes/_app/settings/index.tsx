import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { SettingsPage } from '@/components/settings/settings-page';
import { getAiStatus } from '@/server/ai';
import { listLegalPages } from '@/server/legal-pages';
import { getSiteSettings } from '@/server/settings';

export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: ({ context }) => {
    // SEO people get the Search & sharing section only.
    if (!can(context.user, 'seo:write')) throw redirect({ to: '/' });
  },
  loader: async ({ context }) => {
    const [settings, legalPages, assistant] = await Promise.all([
      getSiteSettings(),
      can(context.user, 'content:write') ? listLegalPages() : undefined,
      can(context.user, 'settings:write') ? getAiStatus() : undefined,
    ]);
    return { settings, legalPages, assistantKeySet: assistant?.keySet };
  },
  head: () => ({ meta: [{ title: 'Settings | Living Legacy CMS' }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return (
    <SettingsPage
      data={data.settings}
      legalPages={data.legalPages}
      assistantKeySet={data.assistantKeySet}
      seoOnly={!can(user, 'settings:write')}
    />
  );
}

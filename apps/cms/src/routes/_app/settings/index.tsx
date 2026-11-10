import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { SettingsPage } from '@/components/settings/settings-page';
import { listLegalPages } from '@/server/legal-pages';
import { getSiteSettings } from '@/server/settings';

export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: ({ context }) => {
    // SEO people get the Search & sharing section only.
    if (!can(context.user.role, 'seo:write')) throw redirect({ to: '/' });
  },
  loader: async ({ context }) => {
    const [settings, legalPages] = await Promise.all([
      getSiteSettings(),
      can(context.user.role, 'content:write') ? listLegalPages() : undefined,
    ]);
    return { settings, legalPages };
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
      seoOnly={!can(user.role, 'settings:write')}
    />
  );
}

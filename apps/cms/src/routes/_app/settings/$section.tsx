import { can } from '@ll/content';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { SettingsPage } from '@/components/settings/settings-page';
import { canOpenSection, isSettingsSectionId } from '@/lib/settings-nav';
import { getAiStatus } from '@/server/ai';
import { listLegalPages } from '@/server/legal-pages';
import { getSiteSettings } from '@/server/settings';

// One address for each page of the site settings form (/settings/general, /settings/search, …).
// The form's state lives in the page component, which stays mounted as the section changes, so
// edits on one page survive a visit to another and one Save covers them all.
export const Route = createFileRoute('/_app/settings/$section')({
  beforeLoad: ({ context, params }) => {
    if (!isSettingsSectionId(params.section)) throw notFound();
    // SEO people open only the pages they can edit.
    if (!canOpenSection(context.user, params.section)) throw redirect({ to: '/' });
  },
  loader: async ({ context }) => {
    const [settings, legalPages, assistant] = await Promise.all([
      getSiteSettings(),
      can(context.user, 'content:write') ? listLegalPages() : undefined,
      can(context.user, 'settings:write') ? getAiStatus() : undefined,
    ]);
    return { settings, legalPages, assistantKeySet: assistant?.keySet };
  },
  // The form is kept as the first load left it; moving between pages must not reset it.
  staleTime: Infinity,
  head: () => ({ meta: [{ title: 'Settings | Living Legacy CMS' }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const { section } = Route.useParams();
  return (
    <SettingsPage
      data={data.settings}
      legalPages={data.legalPages}
      assistantKeySet={data.assistantKeySet}
      seoOnly={!can(user, 'settings:write')}
      section={isSettingsSectionId(section) ? section : 'general'}
    />
  );
}

import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ContentChecksPage } from '@/components/checks/content-checks-page';
import { countContentIssues } from '@/lib/nav-counts';
import { useShareNavCount } from '@/lib/nav-counts-store';
import { getContentChecks } from '@/server/content-checks';

export const Route = createFileRoute('/_app/checks/')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (!can(user, 'posts:publish') && !can(user, 'seo:write')) throw redirect({ to: '/' });
  },
  loader: () => getContentChecks(),
  head: () => ({ meta: [{ title: 'Content checks | Living Legacy CMS' }] }),
  component: ChecksRoute,
});

function ChecksRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  // The sidebar's number for this page: the checks are already here, so it costs no request.
  useShareNavCount('/checks', countContentIssues(data));
  return (
    <ContentChecksPage
      data={data}
      canEditMedia={can(user, 'media:write')}
      // The check is open to people who only look after SEO, who cannot open most of these.
      canFix={{
        post: can(user, 'posts:write') || can(user, 'posts:publish'),
        faq: can(user, 'content:write'),
        event: can(user, 'events:manage'),
        location: can(user, 'content:write'),
        legal: can(user, 'content:write'),
        announcement: can(user, 'content:write'),
      }}
    />
  );
}

import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { ContentChecksPage } from '@/components/checks/content-checks-page';
import { getContentChecks } from '@/server/content-checks';

export const Route = createFileRoute('/_app/checks/')({
  beforeLoad: ({ context }) => {
    const { role } = context.user;
    if (!can(role, 'posts:publish') && !can(role, 'seo:write')) throw redirect({ to: '/' });
  },
  loader: () => getContentChecks(),
  head: () => ({ meta: [{ title: 'Content checks | Living Legacy CMS' }] }),
  component: ChecksRoute,
});

function ChecksRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <ContentChecksPage data={data} canEditMedia={can(user.role, 'media:write')} />;
}

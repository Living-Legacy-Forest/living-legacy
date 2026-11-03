import { can } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { TermsPage } from '@/components/terms/terms-page';
import { listTerms } from '@/server/terms';

export const Route = createFileRoute('/_app/posts/tags/')({
  loader: () => listTerms({ data: { type: 'tag' } }),
  head: () => ({ meta: [{ title: 'Tags | Living Legacy CMS' }] }),
  component: TagsRoute,
});

function TagsRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <TermsPage type="tag" data={data} canWrite={can(user.role, 'content:write')} />;
}

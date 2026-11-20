import { can } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { TermsPage } from '@/components/terms/terms-page';
import { listTerms } from '@/server/terms';

export const Route = createFileRoute('/_app/posts/categories/')({
  loader: () => listTerms({ data: { type: 'category' } }),
  head: () => ({ meta: [{ title: 'Categories | Living Legacy CMS' }] }),
  component: CategoriesRoute,
});

function CategoriesRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return <TermsPage type="category" data={data} canWrite={can(user, 'content:write')} />;
}

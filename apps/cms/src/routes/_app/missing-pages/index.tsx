import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { MissingPagesPage } from '@/components/missing-pages/missing-pages-page';
import { listMissingPages } from '@/server/not-found';

export const Route = createFileRoute('/_app/missing-pages/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'redirects:write')) throw redirect({ to: '/' });
  },
  loader: () => listMissingPages(),
  head: () => ({ meta: [{ title: 'Missing pages | Living Legacy CMS' }] }),
  component: MissingPagesRoute,
});

function MissingPagesRoute() {
  const data = Route.useLoaderData();
  return <MissingPagesPage data={data} />;
}

import { can } from '@llf/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { RedirectsPage } from '@/components/redirects/redirects-page';
import { listRedirects } from '@/server/redirects';

export const Route = createFileRoute('/_app/redirects/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'redirects:write')) throw redirect({ to: '/' });
  },
  loader: () => listRedirects(),
  head: () => ({ meta: [{ title: 'Redirects | Living Legacy CMS' }] }),
  component: RedirectsRoute,
});

function RedirectsRoute() {
  const data = Route.useLoaderData();
  return <RedirectsPage data={data} />;
}

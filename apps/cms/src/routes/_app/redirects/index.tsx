import { can } from '@ll/content';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { RedirectsPage } from '@/components/redirects/redirects-page';
import { listRedirects } from '@/server/redirects';

export const Route = createFileRoute('/_app/redirects/')({
  // An old path to start a new redirect for, from Missing pages.
  validateSearch: z.object({ from: z.string().max(500).optional().catch(undefined) }),
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'redirects:write')) throw redirect({ to: '/' });
  },
  loader: () => listRedirects(),
  head: () => ({ meta: [{ title: 'Redirects | Living Legacy CMS' }] }),
  component: RedirectsRoute,
});

function RedirectsRoute() {
  const data = Route.useLoaderData();
  const { from } = Route.useSearch();
  const navigate = useNavigate({ from: '/redirects/' });
  return (
    <RedirectsPage
      data={data}
      initialFrom={from}
      onOpenedInitial={() => navigate({ search: {}, replace: true })}
    />
  );
}

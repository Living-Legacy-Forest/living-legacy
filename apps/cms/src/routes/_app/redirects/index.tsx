import { can } from '@ll/content';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { MissingPagesPage } from '@/components/missing-pages/missing-pages-page';
import { RedirectsPage } from '@/components/redirects/redirects-page';
import { SegmentedControl } from '@/components/segmented-control';
import { listMissingPages } from '@/server/not-found';
import { listRedirects } from '@/server/redirects';

export const Route = createFileRoute('/_app/redirects/')({
  validateSearch: z.object({
    // An old path to start a new redirect for, from Missing pages.
    from: z.string().max(500).optional().catch(undefined),
    // Missing pages share this page: finding a broken link and fixing it are one job.
    view: z.enum(['missing']).optional().catch(undefined),
    sort: z.string().max(30).optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'redirects:write')) throw redirect({ to: '/' });
  },
  loader: async () => {
    const [redirects, missing] = await Promise.all([listRedirects(), listMissingPages()]);
    return { redirects, missing };
  },
  head: () => ({ meta: [{ title: 'Redirects | Living Legacy CMS' }] }),
  component: RedirectsRoute,
});

function RedirectsRoute() {
  const { redirects, missing } = Route.useLoaderData();
  const { from, view } = Route.useSearch();
  const navigate = useNavigate({ from: '/redirects/' });

  const switcher = (
    <SegmentedControl
      label="Show"
      value={view ?? 'redirects'}
      onValueChange={(next) =>
        navigate({ search: next === 'missing' ? { view: 'missing' } : {}, replace: true })
      }
      options={[
        { value: 'redirects', label: 'Redirects' },
        {
          value: 'missing',
          label: missing.length > 0 ? `Missing pages (${missing.length})` : 'Missing pages',
        },
      ]}
      className="w-auto"
    />
  );

  return view === 'missing' ? (
    <MissingPagesPage data={missing} switcher={switcher} />
  ) : (
    <RedirectsPage
      data={redirects}
      initialFrom={from}
      onOpenedInitial={() => navigate({ search: {}, replace: true })}
      switcher={switcher}
    />
  );
}

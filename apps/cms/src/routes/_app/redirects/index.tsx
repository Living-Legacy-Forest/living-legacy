import { can } from '@ll/content';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useShareNavCount } from '@/lib/nav-counts-store';
import { MissingPagesPage } from '@/components/missing-pages/missing-pages-page';
import { RedirectCoveragePage } from '@/components/redirects/redirect-coverage';
import { RedirectsPage } from '@/components/redirects/redirects-page';
import { SegmentedControl } from '@/components/segmented-control';
import { listMissingPages } from '@/server/not-found';
import { listRedirects } from '@/server/redirects';

export const Route = createFileRoute('/_app/redirects/')({
  validateSearch: z.object({
    // An old path to start a new redirect for, from Missing pages.
    from: z.string().max(500).optional().catch(undefined),
    // Missing pages share this page: finding a broken link and fixing it are one job.
    view: z.enum(['missing', 'coverage']).optional().catch(undefined),
    sort: z.string().max(30).optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'redirects:write')) throw redirect({ to: '/' });
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
  // The sidebar's number for this page: the list is already here, so it costs no request.
  useShareNavCount('/redirects', missing.length);
  const navigate = useNavigate({ from: '/redirects/' });

  const switcher = (
    <SegmentedControl
      label="Show"
      value={view ?? 'redirects'}
      onValueChange={(next) =>
        navigate({ search: next === 'redirects' ? {} : { view: next }, replace: true })
      }
      options={[
        { value: 'redirects', label: 'Redirects' },
        {
          value: 'missing',
          label: missing.length > 0 ? `Missing pages (${missing.length})` : 'Missing pages',
        },
        { value: 'coverage', label: 'Coverage' },
      ]}
      className="w-auto"
    />
  );

  return view === 'missing' ? (
    <MissingPagesPage data={missing} switcher={switcher} />
  ) : view === 'coverage' ? (
    <RedirectCoveragePage switcher={switcher} />
  ) : (
    <RedirectsPage
      data={redirects}
      initialFrom={from}
      onOpenedInitial={() => navigate({ search: {}, replace: true })}
      switcher={switcher}
    />
  );
}

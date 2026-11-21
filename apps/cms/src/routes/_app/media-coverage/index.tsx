import { can } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MediaCoveragePage } from '@/components/media-coverage/media-coverage-page';
import { listMediaCoverage } from '@/server/media-coverage';

export const Route = createFileRoute('/_app/media-coverage/')({
  validateSearch: z.object({
    selected: z.string().optional().catch(undefined),
    sort: z.string().max(30).optional().catch(undefined),
  }),
  loader: () => listMediaCoverage(),
  head: () => ({ meta: [{ title: 'Media coverage | Living Legacy CMS' }] }),
  component: MediaCoverageRoute,
});

function MediaCoverageRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return <MediaCoveragePage data={data} search={search} canWrite={can(user, 'content:write')} />;
}

import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { MediaPage } from '@/components/media/media-page';
import { MEDIA_MAX_SHOWN, MEDIA_PAGE_SIZE } from '@/lib/media-paging';
import { listMedia } from '@/server/media';

const searchSchema = z.object({
  // An image to open in the panel, from a link elsewhere (Content checks).
  selected: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  /** How many files are loaded: grows a page at a time as the grid scrolls. */
  show: z.number().int().min(MEDIA_PAGE_SIZE).max(MEDIA_MAX_SHOWN).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/media/')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'media:write')) throw redirect({ to: '/' });
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listMedia({ data: { q: deps.q, limit: deps.show ?? MEDIA_PAGE_SIZE, include: deps.selected } }),
  head: () => ({ meta: [{ title: 'Media | Living Legacy CMS' }] }),
  component: MediaRoute,
});

function MediaRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return (
    <MediaPage
      data={data}
      search={search}
      canDelete={can(user.role, 'content:purge')}
      initialSelected={search.selected}
    />
  );
}

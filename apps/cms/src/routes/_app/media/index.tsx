import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { MediaPage } from '@/components/media/media-page';
import { MEDIA_MAX_SHOWN, MEDIA_PAGE_SIZE } from '@/lib/media-paging';
import { listMedia, listMediaExtensions, listMediaTags } from '@/server/media';

const searchSchema = z.object({
  // A file to open, from a link elsewhere (Content checks): goes to the file's page.
  selected: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  /** Only images, only documents, or both. */
  types: z
    .array(z.enum(['images', 'documents']))
    .max(2)
    .optional()
    .catch(undefined),
  sort: z.string().max(30).optional().catch(undefined),
  /** Files with any of these tags. */
  tags: z.array(z.string().max(40)).max(20).optional().catch(undefined),
  /** Files with any of these extensions, like pdf or jpg. */
  exts: z
    .array(z.string().regex(/^[a-z0-9]{1,8}$/))
    .max(20)
    .optional()
    .catch(undefined),
  /** How many files are loaded: grows a page at a time as the grid scrolls. */
  show: z.number().int().min(MEDIA_PAGE_SIZE).max(MEDIA_MAX_SHOWN).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/media/')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (!can(context.user, 'media:write')) throw redirect({ to: '/' });
    // Old links opened a file in a side panel; a file now has its own page.
    if (search.selected)
      throw redirect({ to: '/media/$mediaId', params: { mediaId: search.selected } });
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [list, tags, extensions] = await Promise.all([
      listMedia({
        data: {
          q: deps.q,
          sort: deps.sort as never,
          tags: deps.tags,
          exts: deps.exts,
          kinds: deps.types?.map((t) =>
            t === 'images' ? ('image' as const) : ('document' as const)
          ),
          limit: deps.show ?? MEDIA_PAGE_SIZE,
        },
      }),
      listMediaTags(),
      listMediaExtensions(),
    ]);
    return { list, tags, extensions };
  },
  head: () => ({ meta: [{ title: 'Media | Living Legacy CMS' }] }),
  component: MediaRoute,
});

function MediaRoute() {
  const { list: data, tags, extensions } = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return (
    <MediaPage
      data={data}
      tags={tags}
      extensions={extensions}
      search={search}
      canDelete={can(user, 'content:purge')}
    />
  );
}

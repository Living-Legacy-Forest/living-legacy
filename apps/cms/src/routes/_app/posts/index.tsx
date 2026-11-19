import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { PostsList } from '@/components/posts/posts-list';
import { isPostsPageSize, listPosts, postStatusTabs } from '@/server/posts';

const searchSchema = z.object({
  status: z.enum(postStatusTabs).catch('all').default('all'),
  q: z.string().optional().catch(undefined),
  sort: z.string().max(30).optional().catch(undefined),
  categories: z.array(z.string()).optional().catch(undefined),
  authors: z.array(z.string()).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  /** Posts a page, when not the usual 20. */
  rows: z.number().refine(isPostsPageSize).optional().catch(undefined),
  /** Post shown in the preview pane. */
  selected: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/posts/')({
  validateSearch: searchSchema,
  // Changing the previewed post must not reload the list.
  loaderDeps: ({ search: { selected: _selected, ...list } }) => list,
  loader: async ({ deps }) => {
    const data = await listPosts({
      data: { ...deps, sort: deps.sort as never, page: deps.page ?? 1 },
    });
    // A page past the end (a stale link, or a bigger page size than the link was made for) lands
    // on the last page there is, not on an empty one.
    if ((deps.page ?? 1) > data.pageCount) {
      throw redirect({
        to: '/posts',
        search: { ...deps, page: data.pageCount > 1 ? data.pageCount : undefined },
        replace: true,
      });
    }
    return data;
  },
  head: () => ({ meta: [{ title: 'Posts | Living Legacy CMS' }] }),
  component: PostsPage,
});

function PostsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return <PostsList data={data} search={search} user={user} />;
}

import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PostsList } from '@/components/posts/posts-list';
import { listPosts, postStatusTabs } from '@/server/posts';

const searchSchema = z.object({
  status: z.enum(postStatusTabs).catch('all').default('all'),
  q: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  /** Post shown in the preview pane. */
  selected: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/posts/')({
  validateSearch: searchSchema,
  // Changing the previewed post must not reload the list.
  loaderDeps: ({ search: { selected: _selected, ...list } }) => list,
  loader: ({ deps }) => listPosts({ data: { ...deps, page: deps.page ?? 1 } }),
  head: () => ({ meta: [{ title: 'Posts | Living Legacy Forest CMS' }] }),
  component: PostsPage,
});

function PostsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return <PostsList data={data} search={search} user={user} />;
}

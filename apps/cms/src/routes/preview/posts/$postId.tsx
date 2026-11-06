import { createFileRoute, redirect } from '@tanstack/react-router';
import { PostArticle } from '@/components/posts/post-article';
import { PostStatusBadge } from '@/components/posts/post-status-badge';
import { getCurrentUser } from '@/lib/session';
import { getPostPreview } from '@/server/posts';

export const Route = createFileRoute('/preview/posts/$postId')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' });
  },
  loader: ({ params }) => getPostPreview({ data: { id: params.postId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `Preview: ${loaderData?.title || 'Untitled'} | Living Legacy CMS` }],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const post = Route.useLoaderData();

  return (
    <div className="bg-background min-h-svh">
      <div className="bg-background/80 text-ui sticky top-0 z-10 flex h-11 items-center gap-3 border-b px-4 backdrop-blur">
        <span className="font-medium">Preview</span>
        <PostStatusBadge
          status={post.status}
          hasDraft={post.hasDraft}
          scheduledAt={post.scheduledAt}
          showDate
        />
        <span className="text-muted-foreground hidden sm:inline">
          A neutral layout: the finished website design may present it differently.
        </span>
      </div>
      <PostArticle post={post} />
    </div>
  );
}

import { ClientOnly, createFileRoute, redirect } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { PostStatusBadge } from '@/components/posts/post-status-badge';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';
import { getPostPreview } from '@/server/posts';

// Browser only, like the editor: keeps ProseMirror out of the server bundle.
const PostPreviewBody = lazy(() =>
  import('@/components/posts/post-preview').then((m) => ({ default: m.PostPreviewBody }))
);

export const Route = createFileRoute('/preview/posts/$postId')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' });
  },
  loader: ({ params }) => getPostPreview({ data: { id: params.postId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `Preview: ${loaderData?.title || 'Untitled'} | Living Legacy Forest CMS` }],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const post = Route.useLoaderData();

  return (
    <div className="bg-background min-h-svh">
      <div className="bg-background/80 sticky top-0 z-10 flex h-11 items-center gap-3 border-b px-4 text-[13px] backdrop-blur">
        <span className="font-medium">Preview</span>
        <PostStatusBadge status={post.status} hasDraft={post.hasDraft} />
        <span className="text-muted-foreground hidden sm:inline">
          A neutral layout: the finished website design may present it differently.
        </span>
      </div>

      <article className="mx-auto max-w-2xl px-6 py-16">
        {post.categories.length > 0 && (
          <p className="text-muted-foreground mb-3 text-[13px]">{post.categories.join(' · ')}</p>
        )}
        <h1 className="text-4xl leading-tight font-semibold tracking-tight">
          {post.title || 'Untitled'}
        </h1>
        {post.excerpt && (
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed">{post.excerpt}</p>
        )}
        <p className="text-muted-foreground mt-6 border-b pb-6 text-[13px]">
          {[post.author, post.publishedAt ? formatDate(post.publishedAt) : 'Not published yet']
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-8 text-[17px] leading-[1.7]">
          <ClientOnly fallback={<div className="bg-muted/50 h-48 animate-pulse rounded-md" />}>
            <Suspense fallback={<div className="bg-muted/50 h-48 animate-pulse rounded-md" />}>
              <PostPreviewBody body={post.body} />
            </Suspense>
          </ClientOnly>
        </div>
        {post.tags.length > 0 && (
          <ul className="mt-12 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li key={tag} className="bg-muted rounded px-2 py-0.5 text-xs">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

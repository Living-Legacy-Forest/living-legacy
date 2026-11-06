import { ClientOnly } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { formatDate } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import type { PostPreviewData } from '@/server/posts';

// Browser only, like the editor: keeps ProseMirror out of the server bundle.
const PostPreviewBody = lazy(() =>
  import('./post-preview').then((m) => ({ default: m.PostPreviewBody }))
);

const bodyFallback = <div className="bg-muted/50 h-48 animate-pulse rounded-md" />;

/** A post laid out for reading: used by the preview page and the posts list pane. */
export function PostArticle({
  post,
  size = 'page',
}: {
  post: PostPreviewData;
  size?: 'page' | 'pane';
}) {
  const pane = size === 'pane';
  const timeZone = useTimeZone();
  return (
    <article className={cn('mx-auto', pane ? 'max-w-xl px-8 py-10' : 'max-w-2xl px-6 py-16')}>
      {post.categories.length > 0 && (
        <p className="text-muted-foreground text-ui mb-3">{post.categories.join(' · ')}</p>
      )}
      <h1
        className={cn('leading-tight font-semibold tracking-tight', pane ? 'text-2xl' : 'text-4xl')}
      >
        {post.title || 'Untitled'}
      </h1>
      {post.excerpt && (
        <p
          className={cn(
            'text-muted-foreground mt-3 leading-relaxed',
            pane ? 'text-[15px]' : 'text-lg'
          )}
        >
          {post.excerpt}
        </p>
      )}
      <p className="text-muted-foreground text-ui mt-5 border-b pb-5">
        {[
          post.author,
          post.publishedAt
            ? formatDate(post.publishedAt, timeZone)
            : post.scheduledAt
              ? `Scheduled for ${formatDate(post.scheduledAt, timeZone)}`
              : 'Not published yet',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className={cn('mt-6', pane ? 'text-[15px] leading-[1.7]' : 'text-[17px] leading-[1.7]')}>
        <ClientOnly fallback={bodyFallback}>
          <Suspense fallback={bodyFallback}>
            <PostPreviewBody body={post.body} />
          </Suspense>
        </ClientOnly>
      </div>
      {post.tags.length > 0 && (
        <ul className="mt-10 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <li key={tag} className="bg-muted rounded px-2 py-0.5 text-xs">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

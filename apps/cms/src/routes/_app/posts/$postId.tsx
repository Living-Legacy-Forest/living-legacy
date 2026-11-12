import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { postAccessFor } from '@/components/posts/post-editor/post-access';
import { PostEditor } from '@/components/posts/post-editor/post-editor';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { getPostEditorData } from '@/server/posts';

export const Route = createFileRoute('/_app/posts/$postId')({
  // A sidebar section to open and scroll to, for links that fix one thing (Content checks).
  validateSearch: z.object({ focus: z.enum(['seo', 'image']).optional().catch(undefined) }),
  loader: ({ params }) => getPostEditorData({ data: { id: params.postId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.post?.values.title || 'Edit post'} | Living Legacy CMS`,
      },
    ],
  }),
  component: EditPostPage,
});

function EditPostPage() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const { focus } = Route.useSearch();
  const router = useRouter();
  // Held here, not in the editor, which remounts after a discard or restore.
  const reveal = useRevealOnce();
  // Bumped after server-side changes (discard, unpublish, restore) to rebuild
  // the form from fresh loader data. It waits for that data to render:
  // `invalidate()` resolves a render before the new data reaches components,
  // so bumping straight after it rebuilt the form from the old data.
  const [version, setVersion] = useState(0);
  const reloading = useRef(false);
  useEffect(() => {
    if (!reloading.current) return;
    reloading.current = false;
    setVersion((v) => v + 1);
  }, [data]);

  return (
    <PostEditor
      key={`${data.post?.id}-${version}`}
      data={data}
      focus={focus}
      reveal={reveal}
      access={postAccessFor(user, data.post?.createdBy ?? null, !!data.post?.scheduledAt)}
      onReload={async () => {
        reloading.current = true;
        await router.invalidate();
      }}
    />
  );
}

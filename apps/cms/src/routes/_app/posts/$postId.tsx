import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { PostEditor, postAccessFor } from '@/components/posts/post-editor';
import { getPostEditorData } from '@/server/posts';

export const Route = createFileRoute('/_app/posts/$postId')({
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
  const router = useRouter();
  // Bumped after server-side changes (discard, unpublish) to rebuild the form
  // from fresh loader data.
  const [version, setVersion] = useState(0);

  return (
    <PostEditor
      key={`${data.post?.id}-${version}`}
      data={data}
      access={postAccessFor(user, data.post?.createdBy ?? null)}
      onReload={async () => {
        await router.invalidate();
        setVersion((v) => v + 1);
      }}
    />
  );
}

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { PostEditor } from '@/components/posts/post-editor';
import { getPostEditorData } from '@/server/posts';

export const Route = createFileRoute('/_app/posts/$postId')({
  loader: ({ params }) => getPostEditorData({ data: { id: params.postId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.post?.values.title || 'Edit post'} | Living Legacy Forest CMS`,
      },
    ],
  }),
  component: EditPostPage,
});

function EditPostPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  // Bumped after server-side changes (discard, unpublish) to rebuild the form
  // from fresh loader data.
  const [version, setVersion] = useState(0);

  return (
    <PostEditor
      key={`${data.post?.id}-${version}`}
      data={data}
      onReload={async () => {
        await router.invalidate();
        setVersion((v) => v + 1);
      }}
    />
  );
}

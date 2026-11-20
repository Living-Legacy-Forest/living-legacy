import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { postAccessFor } from '@/components/posts/post-editor/post-access';
import { PostEditor } from '@/components/posts/post-editor/post-editor';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { getPostEditorData } from '@/server/posts';

export const Route = createFileRoute('/_app/posts/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.user, 'posts:write')) throw redirect({ to: '/posts' });
  },
  loader: () => getPostEditorData({ data: {} }),
  head: () => ({ meta: [{ title: 'New post | Living Legacy CMS' }] }),
  component: NewPostPage,
});

function NewPostPage() {
  const data = Route.useLoaderData();
  const router = Route.useNavigate();
  const { user } = Route.useRouteContext();
  const reveal = useRevealOnce();
  return (
    <PostEditor
      data={data}
      access={postAccessFor(user, null)}
      reveal={reveal}
      onReload={() => router({ to: '/posts/new' })}
    />
  );
}

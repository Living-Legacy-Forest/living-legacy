import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { PostEditor, postAccessFor } from '@/components/posts/post-editor';
import { getPostEditorData } from '@/server/posts';

export const Route = createFileRoute('/_app/posts/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'posts:write')) throw redirect({ to: '/posts' });
  },
  loader: () => getPostEditorData({ data: {} }),
  head: () => ({ meta: [{ title: 'New post | Living Legacy CMS' }] }),
  component: NewPostPage,
});

function NewPostPage() {
  const data = Route.useLoaderData();
  const router = Route.useNavigate();
  const { user } = Route.useRouteContext();
  return (
    <PostEditor
      data={data}
      access={postAccessFor(user, null)}
      onReload={() => router({ to: '/posts/new' })}
    />
  );
}

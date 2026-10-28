import { createFileRoute } from '@tanstack/react-router';
import { PostEditor } from '@/components/posts/post-editor';
import { getPostEditorData } from '@/server/posts';

export const Route = createFileRoute('/_app/posts/new')({
  loader: () => getPostEditorData({ data: {} }),
  head: () => ({ meta: [{ title: 'New post | Living Legacy Forest CMS' }] }),
  component: NewPostPage,
});

function NewPostPage() {
  const data = Route.useLoaderData();
  const router = Route.useNavigate();
  return <PostEditor data={data} onReload={() => router({ to: '/posts/new' })} />;
}

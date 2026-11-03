import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { MediaPage } from '@/components/media/media-page';
import { listMedia } from '@/server/media';

export const Route = createFileRoute('/_app/media/')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'media:write')) throw redirect({ to: '/' });
  },
  loader: () => listMedia(),
  head: () => ({ meta: [{ title: 'Media | Living Legacy CMS' }] }),
  component: MediaRoute,
});

function MediaRoute() {
  const data = Route.useLoaderData();
  return <MediaPage data={data} />;
}

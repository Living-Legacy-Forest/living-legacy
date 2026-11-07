import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { MediaPage } from '@/components/media/media-page';
import { listMedia } from '@/server/media';

export const Route = createFileRoute('/_app/media/')({
  // An image to open in the panel, from a link elsewhere (Content checks).
  validateSearch: z.object({ selected: z.string().optional().catch(undefined) }),
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'media:write')) throw redirect({ to: '/' });
  },
  loader: () => listMedia(),
  head: () => ({ meta: [{ title: 'Media | Living Legacy CMS' }] }),
  component: MediaRoute,
});

function MediaRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const { selected } = Route.useSearch();
  return (
    <MediaPage data={data} canDelete={can(user.role, 'content:purge')} initialSelected={selected} />
  );
}

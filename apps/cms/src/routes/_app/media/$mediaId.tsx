import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { MediaIcon } from '@/components/icons';
import { MediaDetail } from '@/components/media/media-detail';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { getMediaDetail } from '@/server/media';

export const Route = createFileRoute('/_app/media/$mediaId')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'media:write')) throw redirect({ to: '/' });
  },
  loader: async ({ params }) => {
    const detail = await getMediaDetail({ data: { id: params.mediaId } });
    return { detail };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.detail?.item.filename ?? 'File'} | Living Legacy CMS` }],
  }),
  component: MediaFilePage,
});

function MediaFilePage() {
  const { detail } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  if (!detail) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MediaIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>This file no longer exists</EmptyTitle>
          <EmptyDescription>
            It may have been removed. Go back to the media library.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" render={<Route.Link to="/media" />} nativeButton={false}>
            Back to media
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <MediaDetail key={detail.item.id} detail={detail} canDelete={can(user.role, 'content:purge')} />
  );
}

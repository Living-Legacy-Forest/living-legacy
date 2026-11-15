import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { MapPinIcon } from '@/components/icons';
import { LocationEditor } from '@/components/locations/editor/location-editor';
import { nextSortOrder } from '@/components/locations/editor/location-values';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { listLocations } from '@/server/locations';

export const Route = createFileRoute('/_app/locations/$locationId')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'content:write')) throw redirect({ to: '/locations' });
  },
  loader: async ({ params }) => {
    const all = await listLocations();
    return {
      item: all.find((l) => l.id === params.locationId) ?? null,
      nextOrder: nextSortOrder(all),
    };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.item?.name || 'Location'} | Living Legacy CMS` }],
  }),
  component: LocationPage,
});

function LocationPage() {
  const { item, nextOrder } = Route.useLoaderData();
  const reveal = useRevealOnce();

  if (!item) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPinIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>This location no longer exists</EmptyTitle>
          <EmptyDescription>
            It may have been removed. Go back to the locations list.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" render={<Route.Link to="/locations" />} nativeButton={false}>
            Back to locations
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return <LocationEditor key={item.id} item={item} nextOrder={nextOrder} reveal={reveal} />;
}

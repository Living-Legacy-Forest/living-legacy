import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { LocationEditor } from '@/components/locations/editor/location-editor';
import { nextSortOrder } from '@/components/locations/editor/location-values';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { listLocations } from '@/server/locations';

export const Route = createFileRoute('/_app/locations/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'content:write')) throw redirect({ to: '/locations' });
  },
  loader: async () => ({ nextOrder: nextSortOrder(await listLocations()) }),
  head: () => ({ meta: [{ title: 'Add location | Living Legacy CMS' }] }),
  component: NewLocationPage,
});

function NewLocationPage() {
  const { nextOrder } = Route.useLoaderData();
  const reveal = useRevealOnce();
  return <LocationEditor item={null} nextOrder={nextOrder} reveal={reveal} />;
}

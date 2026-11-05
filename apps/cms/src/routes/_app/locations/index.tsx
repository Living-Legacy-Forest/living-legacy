import { can } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LocationsPage } from '@/components/locations/locations-page';
import { listLocations } from '@/server/locations';

export const Route = createFileRoute('/_app/locations/')({
  validateSearch: z.object({ selected: z.string().optional().catch(undefined) }),
  loader: () => listLocations(),
  head: () => ({ meta: [{ title: 'Locations | Living Legacy CMS' }] }),
  component: LocationsRoute,
});

function LocationsRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  return <LocationsPage data={data} search={search} canWrite={can(user.role, 'content:write')} />;
}

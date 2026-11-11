import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { EventsOverview } from '@/components/events/overview/events-overview';
import { getEventsOverview, overviewSearch } from '@/server/event-stats';

export const Route = createFileRoute('/_app/events/overview')({
  validateSearch: overviewSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => ({ data: await getEventsOverview({ data: deps }), now: Date.now() }),
  head: () => ({ meta: [{ title: 'Events overview | Living Legacy CMS' }] }),
  component: EventsOverviewRoute,
});

function EventsOverviewRoute() {
  const { data, now } = Route.useLoaderData();
  const navigate = useNavigate({ from: '/events/overview' });
  return (
    <EventsOverview
      data={data}
      now={now}
      // The default range stays out of the address, so a plain link shows it.
      onRangeChange={(range) =>
        navigate({ search: (s) => ({ ...s, range: range === '90d' ? undefined : range }) })
      }
      onLocationChange={(location) => navigate({ search: (s) => ({ ...s, location }) })}
    />
  );
}

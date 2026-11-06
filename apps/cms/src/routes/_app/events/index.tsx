import { createFileRoute } from '@tanstack/react-router';
import { EventsPage } from '@/components/events/events-page';
import { listEvents } from '@/server/events';

export const Route = createFileRoute('/_app/events/')({
  loader: () => listEvents(),
  head: () => ({ meta: [{ title: 'Events | Living Legacy CMS' }] }),
  component: EventsRoute,
});

function EventsRoute() {
  return <EventsPage data={Route.useLoaderData()} />;
}

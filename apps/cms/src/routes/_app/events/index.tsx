import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { EventsPage } from '@/components/events/events-page';
import { listEvents } from '@/server/events';

export const Route = createFileRoute('/_app/events/')({
  // An event date to open on arrival, for links that fix one thing (Content checks).
  validateSearch: z.object({ open: z.string().max(64).optional().catch(undefined) }),
  loader: () => listEvents(),
  head: () => ({ meta: [{ title: 'Events | Living Legacy CMS' }] }),
  component: EventsRoute,
});

function EventsRoute() {
  const { open } = Route.useSearch();
  const navigate = useNavigate({ from: '/events/' });
  return (
    <EventsPage
      data={Route.useLoaderData()}
      initialOpen={open}
      onOpenedInitial={() => navigate({ search: {}, replace: true })}
    />
  );
}

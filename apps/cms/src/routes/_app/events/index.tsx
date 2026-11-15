import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { EventsPage } from '@/components/events/events-page';
import { legacyEventRedirect } from '@/lib/legacy-event-link';
import { listEvents } from '@/server/events';

export const Route = createFileRoute('/_app/events/')({
  // Old links open an event with ?open=; they now go to its own page.
  validateSearch: z.object({
    open: z.string().max(64).optional().catch(undefined),
    view: z.enum(['details', 'guests', 'dashboard']).optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    const to = legacyEventRedirect(search);
    if (to) throw redirect(to);
  },
  loader: () => listEvents(),
  head: () => ({ meta: [{ title: 'Events | Living Legacy CMS' }] }),
  component: EventsRoute,
});

function EventsRoute() {
  return <EventsPage data={Route.useLoaderData()} />;
}

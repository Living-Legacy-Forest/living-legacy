import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { EventEditor } from '@/components/events/editor/event-editor';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { getEventLocations } from '@/server/events';

export const Route = createFileRoute('/_app/events/new')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'events:manage')) throw redirect({ to: '/events' });
  },
  loader: async () => ({ locations: await getEventLocations() }),
  head: () => ({ meta: [{ title: 'New event | Living Legacy CMS' }] }),
  component: NewEventPage,
});

function NewEventPage() {
  const { locations } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const reveal = useRevealOnce();
  return (
    <EventEditor
      data={{ event: null, dates: [], locations }}
      reveal={reveal}
      onReload={() => navigate({ to: '/events/new' })}
    />
  );
}

import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { CalendarClockIcon } from '@/components/icons';
import { EventEditor } from '@/components/events/editor/event-editor';
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
import { getEventPage } from '@/server/events';

export const Route = createFileRoute('/_app/events/$eventId')({
  // Which part of the event to show; details is the default.
  validateSearch: z.object({
    view: z.enum(['details', 'guests', 'dashboard']).optional().catch(undefined),
  }),
  loader: ({ params }) => getEventPage({ data: { id: params.eventId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.event.title || 'Event'} | Living Legacy CMS` }],
  }),
  component: EventPage,
});

function EventPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  // Held here, not in the editor, which remounts after a save.
  const reveal = useRevealOnce();
  // Bumped after a save to rebuild the form from fresh loader data. It waits for that
  // data to render: `invalidate()` resolves a render before the new data reaches
  // components, so bumping straight after it rebuilt the form from the old data.
  const [version, setVersion] = useState(0);
  const reloading = useRef(false);
  useEffect(() => {
    if (!reloading.current) return;
    reloading.current = false;
    setVersion((v) => v + 1);
  }, [data]);

  if (!data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClockIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>This event no longer exists</EmptyTitle>
          <EmptyDescription>It may have been deleted. Go back to the events list.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" render={<Route.Link to="/events" />} nativeButton={false}>
            Back to events
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <EventEditor
      key={`${data.event.id}-${version}`}
      data={data}
      reveal={reveal}
      onReload={async () => {
        reloading.current = true;
        await router.invalidate();
      }}
    />
  );
}

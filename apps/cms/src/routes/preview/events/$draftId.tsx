import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { EventArticle } from '@/components/events/event-article';
import { type EventPreviewDraft, readEventPreview } from '@/components/events/event-preview-store';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getCurrentUser } from '@/lib/session';
import { type EventPreviewExtras, getEventPreviewExtras } from '@/server/events';

export const Route = createFileRoute('/preview/events/$draftId')({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: '/login' });
    if (!can(user.role, 'events:manage')) throw redirect({ to: '/' });
  },
  head: () => ({ meta: [{ title: 'Event preview | Living Legacy CMS' }] }),
  component: PreviewPage,
});

const STATUS_LABEL = { draft: 'Draft', published: 'Published', cancelled: 'Cancelled' } as const;

function PreviewPage() {
  const { draftId } = Route.useParams();
  // The form's values live in this browser only (see event-preview-store.ts),
  // so they are read once the page is running here.
  const [event, setEvent] = useState<EventPreviewDraft | null | undefined>(undefined);
  const [extras, setExtras] = useState<EventPreviewExtras | null>(null);

  useEffect(() => {
    const draft = readEventPreview(draftId);
    setEvent(draft);
    if (!draft) return;
    document.title = `Preview: ${draft.title || 'Untitled event'} | Living Legacy CMS`;
    let active = true;
    getEventPreviewExtras({
      data: {
        locationId: draft.locationId,
        mediaIds: [...(draft.heroMediaId ? [draft.heroMediaId] : []), ...draft.galleryMediaIds],
        seriesId: draft.seriesId,
        eventId: draft.id,
      },
    }).then(
      (found) => active && setExtras(found),
      // Without them the page still shows the form's own values.
      () => active && setExtras({ location: null, photos: [], otherDates: [] })
    );
    return () => {
      active = false;
    };
  }, [draftId]);

  return (
    <div className="bg-background min-h-svh">
      <div className="bg-background/80 text-ui sticky top-0 z-20 flex h-11 items-center gap-3 border-b px-4 backdrop-blur">
        <span className="font-medium">Preview</span>
        {event && <Badge variant="secondary">{STATUS_LABEL[event.status]}</Badge>}
        <span className="text-muted-foreground hidden truncate sm:inline">
          Unsaved changes are shown here; nothing has been saved. The website does not list events
          yet, so its design may differ.
        </span>
      </div>
      {event === undefined ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : event === null ? (
        <p className="text-muted-foreground mx-auto max-w-md px-6 py-24 text-center">
          This preview is no longer available. Open it again from the event.
        </p>
      ) : (
        <EventArticle event={event} extras={extras} />
      )}
    </div>
  );
}

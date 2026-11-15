/**
 * The event page, split by job:
 *
 *   use-event-editor.ts     state, saving and the warning before leaving
 *   event-values.ts         the rules behind the form, tested on their own
 *   event-toolbar.tsx       status and the actions above the page
 *   event-main.tsx          cover, title, summary, description and sessions
 *   event-side-panel.tsx    bookings, places, publishing, location, photos, address
 *   event-actions.tsx       preview, and the cancel, delete and scope dialogs
 */
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ResizablePanel,
  ResizablePanels,
} from '@/components/arc/resizable-panels/resizable-panels';
import { TOUCH_FIELDS } from '@/components/form-steps';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EventPageData } from '@/server/events';
import {
  CancelEventDialog,
  CancelledEventSummary,
  DeleteEventButton,
  DeleteEventDialog,
  PreviewButton,
  ScopeDialog,
} from './event-actions';
import { EventMain } from './event-main';
import { EventSidePanel } from './event-side-panel';
import { EventToolbar } from './event-toolbar';
import { useEventEditor } from './use-event-editor';

/**
 * Create and edit page for an event. Remount it (change its `key`) to reload
 * from the server, for example after saving.
 */
export function EventEditor({
  data,
  reveal = false,
  onReload,
}: {
  /** `event` is null on /events/new. */
  data: Omit<EventPageData, 'event'> & { event: EventPageData['event'] | null };
  /** Plays the page's arrival animation; the route turns it off once it has played. */
  reveal?: boolean;
  onReload: () => Promise<void>;
}) {
  const { event, locations } = data;
  const navigate = useNavigate();
  const editor = useEventEditor({
    event,
    locations,
    onSaved: (id) =>
      event
        ? void onReload()
        : void navigate({ to: '/events/$eventId', params: { eventId: id }, replace: true }),
  });
  const [showSide, setShowSide] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const leave = () => {
    editor.skipBlock();
    void navigate({ to: '/events' });
  };

  if (event?.status === 'cancelled') {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <h1 className="sr-only">{event.title}</h1>
        <CancelledEventSummary
          event={event}
          zoneLabel={formatDateTime(event.startsAt, event.timeZone)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PreviewButton draft={() => ({ ...event, moreDates: [] })} />
          <DeleteEventButton event={event} onRemoved={leave} />
        </div>
        <Button variant="ghost" size="sm" render={<Link to="/events" />} nativeButton={false}>
          Back to events
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={editor.submit}
      data-slot="event-editor"
      data-revealing={reveal || undefined}
      className={cn('flex flex-1 flex-col', TOUCH_FIELDS)}
    >
      <h1 className="sr-only">{event?.title || 'New event'}</h1>
      <ResizablePanels
        label="Event and details"
        className={cn(
          'flex-1',
          // Below lg the panel sits under the form and its divider goes. From lg, hiding
          // the panel also hides the divider.
          'max-lg:block! max-lg:[&>*+*]:mt-6 max-lg:[&>[role=separator]]:hidden',
          !showSide && '[&>[role=separator]]:hidden'
        )}
      >
        <ResizablePanel
          id="event-editor-main"
          label="Event"
          defaultSize={70}
          minSize={420}
          className="max-lg:max-w-none!"
        >
          <div
            data-slot="event-editor-main"
            className={cn(
              'bg-background flex min-w-0 flex-col overflow-hidden rounded-lg border lg:h-[calc(100svh-7.5rem)]',
              showSide && 'lg:mr-6'
            )}
          >
            <EventToolbar
              editor={editor}
              event={event}
              showSide={showSide}
              onToggleSide={() => setShowSide((v) => !v)}
              onCancelEvent={() => setCancelling(true)}
              onDelete={() => setDeleting(true)}
            />
            <div className="min-h-[24rem] flex-1 overflow-y-auto p-6 max-md:px-0 lg:min-h-0">
              <EventMain editor={editor} event={event} />
            </div>
          </div>
        </ResizablePanel>

        <ResizablePanel
          id="event-side-panel"
          label="Details"
          defaultSize={30}
          minSize={260}
          maxSize={560}
          // Hidden only on lg and up: below that the panel sits under the form and has no toggle.
          className={cn('max-lg:max-w-none!', !showSide && 'lg:hidden!')}
        >
          <aside
            id="event-side"
            className="text-ui lg:no-scrollbar min-w-0 lg:h-[calc(100svh-7.5rem)] lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:pl-6"
          >
            <EventSidePanel editor={editor} event={event} />
          </aside>
        </ResizablePanel>
      </ResizablePanels>

      {event && (
        <>
          <ScopeDialog
            open={editor.askScope}
            onOpenChange={editor.setAskScope}
            title="Which dates should change?"
            description="Save to this date only, or to this date and the upcoming ones. A date you edited on its own keeps its values, unless you changed the same thing here."
            onChoose={editor.chooseScope}
          />
          <CancelEventDialog
            event={event}
            open={cancelling}
            onOpenChange={setCancelling}
            onDone={() => {
              editor.skipBlock();
              void onReload();
            }}
          />
          <DeleteEventDialog
            event={event}
            open={deleting}
            onOpenChange={setDeleting}
            onRemoved={leave}
          />
        </>
      )}

      <AlertDialog open={editor.blocker.status === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved changes to this event will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => editor.blocker.reset?.()}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => editor.blocker.proceed?.()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

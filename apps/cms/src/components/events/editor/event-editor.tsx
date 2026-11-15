/**
 * The event page, split by job:
 *
 *   use-event-editor.ts     state, saving and the warning before leaving
 *   event-values.ts         the rules behind the form, tested on their own
 *   event-toolbar.tsx       status and the actions above the page
 *   event-main.tsx          cover, title, summary, description and sessions
 *   event-side-panel.tsx    bookings, places, publishing, location, photos, address
 *   event-views.tsx         the Details / Guests / Dashboard tabs and the date picker
 *   event-actions.tsx       preview, and the cancel, delete and scope dialogs
 */
import { useNavigate } from '@tanstack/react-router';
import { useState, useSyncExternalStore } from 'react';
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
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EventPageData } from '@/server/events';
import { EventDashboardPanel } from '../dashboard/event-dashboard';
import { EventGuests } from '../event-guests';
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
import { type EventView, EventViewBar, EventViewsHeader } from './event-views';
import { useEventEditor } from './use-event-editor';

/** From `lg` the side panel sits beside the form and can be hidden; below it, it stacks under. */
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(min-width: 1024px)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true
  );
}

/**
 * Create and edit page for an event. Remount it (change its `key`) to reload
 * from the server, for example after saving.
 */
export function EventEditor({
  data,
  view = 'details',
  onViewChange,
  onPickDate,
  reveal = false,
  onReload,
}: {
  /** `event` is null on /events/new. */
  data: Omit<EventPageData, 'event'> & { event: EventPageData['event'] | null };
  view?: EventView;
  onViewChange?: (view: EventView) => void;
  /** Opens another date of the event's series, on the same view. */
  onPickDate?: (id: string) => void;
  /** Plays the page's arrival animation; the route turns it off once it has played. */
  reveal?: boolean;
  onReload: () => Promise<void>;
}) {
  const { event, dates, locations } = data;
  const navigate = useNavigate();
  const editor = useEventEditor({
    event,
    locations,
    // A saved event stays as it is; only a new one has somewhere to go.
    onSaved: (id) => {
      if (!event) void navigate({ to: '/events/$eventId', params: { eventId: id }, replace: true });
    },
  });
  const [showSide, setShowSide] = useState(true);
  const desktop = useIsDesktop();
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The Dashboard can also show every date together; the other views show one.
  const [allDates, setAllDates] = useState(false);

  const cancelled = event?.status === 'cancelled';
  const showingAll = view === 'dashboard' && allDates && dates.length > 1;

  /** Goes to the list; the promise settles once it has, before anything is refreshed. */
  const leave = () => {
    editor.skipBlock();
    return navigate({ to: '/events' });
  };

  const viewBar = event && (
    <EventViewBar
      view={view}
      onViewChange={(next) => onViewChange?.(next)}
      event={event}
      dates={dates}
      showingAll={showingAll}
      onPickDate={(id) => {
        setAllDates(id === null);
        if (id) onPickDate?.(id);
      }}
    />
  );

  return (
    <>
      <h1 className="sr-only">{event?.title || 'New event'}</h1>

      {/* Guests and Dashboard take the whole width; a cancelled event's details are a summary. */}
      {event && (view !== 'details' || cancelled) && (
        <div className="bg-background flex min-w-0 flex-1 flex-col rounded-lg border">
          <EventViewsHeader
            view={view}
            onViewChange={(next) => onViewChange?.(next)}
            event={event}
            dates={dates}
            showingAll={showingAll}
            onPickDate={(id) => {
              setAllDates(id === null);
              if (id) onPickDate?.(id);
            }}
          />
          <div
            key={view}
            className="animate-in fade-in p-6 duration-200 motion-reduce:animate-none max-md:px-4"
          >
            {view === 'guests' ? (
              <EventGuests key={event.id} event={event} />
            ) : view === 'dashboard' ? (
              <EventDashboardPanel
                eventId={event.id}
                date={showingAll ? undefined : event.id}
                onDateChange={(id) => {
                  setAllDates(id === undefined);
                  if (id) onPickDate?.(id);
                }}
                onOpenGuests={() => onViewChange?.('guests')}
              />
            ) : (
              <div className="mx-auto max-w-xl space-y-4">
                <CancelledEventSummary
                  event={event}
                  zoneLabel={formatDateTime(event.startsAt, event.timeZone)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PreviewButton draft={() => ({ ...event, moreDates: [] })} />
                  <DeleteEventButton event={event} onRemoved={leave} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kept mounted behind the other views, so unsaved changes survive a look at the guests. */}
      {!cancelled && (
        <form
          noValidate
          onSubmit={editor.submit}
          data-slot="event-editor"
          data-revealing={reveal || undefined}
          className={cn('flex flex-1 flex-col', TOUCH_FIELDS, view !== 'details' && 'hidden')}
        >
          <ResizablePanels
            label="Event and details"
            className={cn(
              'flex-1',
              // Below lg the panel sits under the form and its divider goes.
              'max-lg:block! max-lg:[&>*+*]:mt-6 max-lg:[&>[role=separator]]:hidden'
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
                  // The gap closes with the panel, on the same curve, so the card does not jump.
                  'motion-reduce:transition-none lg:transition-[margin-right] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
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
                >
                  {viewBar}
                </EventToolbar>
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
              // Hiding glides shut and the content fades, the way dragging the divider does. Only
              // from lg: below that the panel sits under the form and has no toggle.
              collapsible
              collapsed={!showSide && desktop}
              onCollapsedChange={(hidden) => setShowSide(!hidden)}
              className="max-lg:max-w-none!"
            >
              <aside
                id="event-side"
                className="text-ui lg:no-scrollbar min-w-0 lg:h-[calc(100svh-7.5rem)] lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:pl-6"
              >
                <EventSidePanel editor={editor} event={event} />
              </aside>
            </ResizablePanel>
          </ResizablePanels>
        </form>
      )}

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
    </>
  );
}

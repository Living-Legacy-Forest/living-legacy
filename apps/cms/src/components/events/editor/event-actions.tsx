import type { SeriesScope } from '@ll/content';
import { useState } from 'react';
import { EyeIcon, Trash2Icon } from '@/components/icons';
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
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type EventRow, cancelEvent, deleteEvent } from '@/server/events';
import { type EventPreviewDraft, openEventPreview } from '../event-preview-store';

/** Opens the event as a visitor would see it, in a new tab. */
export function PreviewButton({ draft }: { draft: () => EventPreviewDraft }) {
  return (
    <Button type="button" variant="outline" onClick={() => openEventPreview(draft())}>
      <EyeIcon aria-hidden data-icon="inline-start" />
      <span className="max-sm:sr-only">Preview</span>
    </Button>
  );
}

/** Room for Cancel and both scope buttons on one line. */
const SCOPE_DIALOG = 'data-[size=default]:sm:max-w-lg';

/** The two buttons a repeating event's dialogs end with, or the one for a single event. */
function ScopeActions({
  series,
  label,
  safe = false,
  onChoose,
}: {
  series: boolean;
  label: string;
  /** Saving loses nothing, so phones' action sheet does not draw it red. */
  safe?: boolean;
  onChoose: (scope: SeriesScope) => void;
}) {
  const tone = safe ? 'default' : undefined;
  if (!series)
    return (
      <AlertDialogAction data-tone={tone} onClick={() => onChoose('one')}>
        {label}
      </AlertDialogAction>
    );
  return (
    <>
      <AlertDialogAction data-tone={tone} variant="outline" onClick={() => onChoose('one')}>
        This date only
      </AlertDialogAction>
      <AlertDialogAction data-tone={tone} onClick={() => onChoose('following')}>
        This and upcoming dates
      </AlertDialogAction>
    </>
  );
}

/** Asks whether a change to a repeating event is for this date or the upcoming ones too. */
export function ScopeDialog({
  open,
  onOpenChange,
  title,
  description,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onChoose: (scope: SeriesScope) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={SCOPE_DIALOG}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <ScopeActions series safe label="Save" onChoose={onChoose} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const datesNote = (n: number) => (n > 1 ? ` on ${n} dates` : '');

type DialogProps = { event: EventRow; open: boolean; onOpenChange: (open: boolean) => void };

/** The dialog behind "Cancel event"; whoever shows it owns whether it is open. */
export function CancelEventDialog({
  event,
  open,
  onOpenChange,
  onDone,
}: DialogProps & { onDone?: () => void }) {
  const { run } = useAction();
  const n = event.bookings;
  const series = Boolean(event.seriesId);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn(series && SCOPE_DIALOG)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {n === 0
              ? 'Nobody has booked this date yet.'
              : `${n} ${n === 1 ? 'booking stays' : 'bookings stay'} on its guest list, and HubSpot tells the guests once it is connected.`}{' '}
            {series && 'Cancel this date only, or the upcoming dates too. '}
            Cancelled dates stay in the list. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <ScopeActions
            series={series}
            label="Cancel event"
            onChoose={(scope) =>
              run(() => cancelEvent({ data: { id: event.id, scope } }), {
                success: (r) => ({
                  title: `Event cancelled${datesNote(r.dates)}`,
                  description: 'Cancelled dates stay in the list.',
                }),
                error: 'Could not cancel the event',
              }).then((done) => done && onDone?.())
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The dialog behind "Delete"; whoever shows it owns whether it is open. */
export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onRemoved,
}: DialogProps & { onRemoved: () => void | Promise<void> }) {
  const { run } = useAction();
  const series = Boolean(event.seriesId);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn(series && SCOPE_DIALOG)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {series && 'Delete this date only, or the upcoming dates too. '}
            Guest lists are deleted with their dates. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <ScopeActions
            series={series}
            label="Delete"
            onChoose={(scope) =>
              run(() => deleteEvent({ data: { id: event.id, scope } }), {
                success: (r) => removedNotice(Math.max(1, r.dates), ['event date', 'event dates']),
                error: 'Could not delete the event',
                // Gone, so leave before the page's own data is reloaded and finds nothing.
                afterAction: () => onRemoved(),
              })
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A small "Delete" button that opens its own dialog. */
export function DeleteEventButton({
  event,
  onRemoved,
}: {
  event: EventRow;
  onRemoved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden data-icon="inline-start" />
        Delete
      </Button>
      <DeleteEventDialog event={event} open={open} onOpenChange={setOpen} onRemoved={onRemoved} />
    </>
  );
}

/** A cancelled event cannot change, so it is shown, not edited. */
export function CancelledEventSummary({
  event,
  zoneLabel,
}: {
  event: EventRow;
  /** Its start, already formatted in its own time zone. */
  zoneLabel: string;
}) {
  return (
    <div className="space-y-4">
      <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2.5 text-sm">
        This event is cancelled. Its bookings are kept for the record.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">When</dt>
        <dd>{zoneLabel}</dd>
        <dt className="text-muted-foreground">Where</dt>
        <dd>{event.venue || event.locationName || 'Not set'}</dd>
        <dt className="text-muted-foreground">Bookings</dt>
        <dd className="tabular-nums">{event.bookings}</dd>
      </dl>
    </div>
  );
}

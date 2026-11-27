// Moves between the dates of a repeating event, each with its own form and guest list.
import { FIELD_LABEL } from '@/components/form-cells';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatDateTime, zoneName } from '@/lib/format';
import type { EventRow } from '@/server/events';
import { SeriesCalendar } from './series-calendar';

/** When a date starts, in its own zone: events in another state show their local time. */
export const startsIn = (e: EventRow) =>
  `${formatDateTime(e.startsAt, e.timeZone)} ${zoneName(e.timeZone, e.startsAt)}`;

/** How one date stands: its places once published, otherwise its state. */
export function dateStatus(e: EventRow) {
  if (e.status === 'draft') return e.publishAt ? 'Scheduled' : 'Draft';
  if (e.status === 'cancelled') return 'Cancelled';
  return `${e.booked} / ${e.capacity ?? '∞'} booked`;
}

export function SeriesDatePicker({
  event,
  dates,
  onPick,
  allDates = false,
  compact = false,
}: {
  /** The date being viewed; null when all of them are (only with allDates). */
  event: EventRow | null;
  /** Soonest first. */
  dates: EventRow[];
  /** A date's id, or null for all dates. */
  onPick: (id: string | null) => void;
  /** Offer "All dates", as the Dashboard tab does. */
  allDates?: boolean;
  /** A small button with no visible label, for the row beside the tabs. */
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor="ev-viewing" className={cn(FIELD_LABEL, compact && 'sr-only')}>
        Viewing date
      </Label>
      <SeriesCalendar
        id="ev-viewing"
        dates={dates}
        selectedId={event?.id ?? null}
        onPick={onPick}
        label={event ? `${startsIn(event)} · ${dateStatus(event)}` : 'All dates'}
        allDates={allDates}
        compact={compact}
      />
    </div>
  );
}

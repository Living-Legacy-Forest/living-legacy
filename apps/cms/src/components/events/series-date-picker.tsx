// Moves between the dates of a repeating event, each with its own form and guest list.
import { Label } from '@/components/ui/label';
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
}: {
  event: EventRow;
  /** Soonest first. */
  dates: EventRow[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="ev-viewing">Viewing date</Label>
      <SeriesCalendar
        id="ev-viewing"
        dates={dates}
        selectedId={event.id}
        onPick={(id) => id && onPick(id)}
        label={`${startsIn(event)} · ${dateStatus(event)}`}
      />
    </div>
  );
}

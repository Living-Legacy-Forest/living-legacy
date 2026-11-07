// Moves between the dates of a repeating event, each with its own form and guest
// list. A calendar shows them spread over the months, and only they can be picked.
import { toZoned } from '@ll/content';
import { useState } from 'react';
import { CalendarClockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { displayTime, formatDateTime, zoneName } from '@/lib/format';
import type { EventRow } from '@/server/events';

/** When a date starts, in its own zone: events in another state show their local time. */
export const startsIn = (e: EventRow) =>
  `${formatDateTime(e.startsAt, e.timeZone)} ${zoneName(e.timeZone, e.startsAt)}`;

/** How one date stands: its places once published, otherwise its state. */
export function dateStatus(e: EventRow) {
  if (e.status === 'draft') return e.publishAt ? 'Scheduled' : 'Draft';
  if (e.status === 'cancelled') return 'Cancelled';
  return `${e.booked} / ${e.capacity ?? '∞'} booked`;
}

/** The day it falls on in its own zone, as the calendar's local date. */
function dayOf(e: EventRow) {
  const w = toZoned(e.startsAt, e.timeZone);
  return new Date(w.year, w.month, w.day);
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

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
  const [open, setOpen] = useState(false);
  const byDay = new Map<string, EventRow[]>();
  for (const d of dates) {
    const key = dayKey(dayOf(d));
    byDay.set(key, [...(byDay.get(key) ?? []), d]);
  }
  const viewing = dayOf(event);
  const sessions = byDay.get(dayKey(viewing)) ?? [];

  return (
    <div className="space-y-1.5">
      <Label htmlFor="ev-viewing">Viewing date</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id="ev-viewing"
              type="button"
              variant="outline"
              className="touch:min-h-11 w-full justify-start px-2.5 font-normal"
            />
          }
        >
          <CalendarClockIcon aria-hidden data-icon="inline-start" />
          <span className="truncate">
            {startsIn(event)} · {dateStatus(event)}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
          <Calendar
            mode="single"
            required
            weekStartsOn={1}
            className="w-full px-3"
            // A gap between days, so neighbouring dates sit apart rather than as one block.
            classNames={{
              root: 'w-full',
              weekdays: 'flex gap-1.5',
              week: 'mt-1.5 flex w-full gap-1.5',
            }}
            selected={viewing}
            defaultMonth={viewing}
            startMonth={dayOf(dates[0]!)}
            endMonth={dayOf(dates[dates.length - 1]!)}
            disabled={(day) => !byDay.has(dayKey(day))}
            modifiers={{
              hasDate: dates.map(dayOf),
              cancelled: dates.filter((d) => d.status === 'cancelled').map(dayOf),
            }}
            modifiersClassNames={{
              hasDate: '[&>button]:bg-muted [&>button]:font-medium',
              cancelled: '[&>button]:line-through',
            }}
            onSelect={(day) => {
              // The day already shown keeps the session being viewed.
              const first = byDay.get(dayKey(day))?.[0];
              if (first && dayKey(day) !== dayKey(viewing)) onPick(first.id);
              setOpen(false);
            }}
          />
          <p className="text-muted-foreground border-t px-3 py-2 text-xs">
            {dates.length} dates in this event. Each has its own guest list.
          </p>
        </PopoverContent>
      </Popover>

      {sessions.length > 1 && (
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[event.id]}
          onValueChange={(value) => value[0] && onPick(value[0])}
          aria-label="Time on this date"
          className="touch:flex-wrap"
        >
          {sessions.map((s) => {
            const w = toZoned(s.startsAt, s.timeZone);
            return (
              <ToggleGroupItem key={s.id} value={s.id} className="touch:min-h-11 text-xs">
                {displayTime(`${w.hour}:${w.minute}`)}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}
    </div>
  );
}

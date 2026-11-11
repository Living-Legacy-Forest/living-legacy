// Picks one date of a repeating event from a calendar that shows them spread
// over the months; only those days can be picked. A day with more than one
// session gets a row of times under it. Used by the Viewing date picker and the
// event dashboard, which can also pick "All dates" (null).
import { toZoned } from '@ll/content';
import { type ReactNode, useState } from 'react';
import { CalendarClockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { displayTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export type SeriesDate = { id: string; startsAt: number; timeZone: string; status: string };

/** The day it falls on in its own zone, as the calendar's local date. */
function dayOf(d: SeriesDate) {
  const w = toZoned(d.startsAt, d.timeZone);
  return new Date(w.year, w.month, w.day);
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function SeriesCalendar({
  id,
  dates,
  selectedId,
  onPick,
  label,
  allDates = false,
  className,
}: {
  id?: string;
  /** Soonest first. */
  dates: SeriesDate[];
  /** null when every date is shown (only with allDates). */
  selectedId: string | null;
  onPick: (id: string | null) => void;
  /** What the trigger says. */
  label: ReactNode;
  /** Offer an "All dates" choice under the calendar. */
  allDates?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const byDay = new Map<string, SeriesDate[]>();
  for (const d of dates) {
    const key = dayKey(dayOf(d));
    byDay.set(key, [...(byDay.get(key) ?? []), d]);
  }
  const selected = dates.find((d) => d.id === selectedId) ?? null;
  const viewing = selected ? dayOf(selected) : undefined;
  const sessions = viewing ? (byDay.get(dayKey(viewing)) ?? []) : [];

  return (
    <div className={cn('space-y-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="touch:min-h-11 w-full justify-start px-2.5 font-normal"
            />
          }
        >
          <CalendarClockIcon aria-hidden data-icon="inline-start" />
          <span className="truncate">{label}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
          <Calendar
            mode="single"
            weekStartsOn={1}
            className="w-full px-3"
            // A gap between days, so neighbouring dates sit apart rather than as one block.
            classNames={{
              root: 'w-full',
              weekdays: 'flex gap-1.5',
              week: 'mt-1.5 flex w-full gap-1.5',
            }}
            selected={viewing}
            defaultMonth={
              viewing ?? dayOf(dates.find((d) => d.startsAt >= Date.now()) ?? dates[0]!)
            }
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
              // Clicking the day already shown keeps the session being viewed.
              const first = day && byDay.get(dayKey(day))?.[0];
              if (first && (!viewing || dayKey(day) !== dayKey(viewing))) onPick(first.id);
              setOpen(false);
            }}
          />
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <p className="text-muted-foreground text-xs">
              {dates.length} dates in this event. Each has its own guest list.
            </p>
            {allDates && (
              <Button
                type="button"
                size="sm"
                variant={selected ? 'outline' : 'secondary'}
                onClick={() => {
                  onPick(null);
                  setOpen(false);
                }}
              >
                All dates
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {sessions.length > 1 && selected && (
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[selected.id]}
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

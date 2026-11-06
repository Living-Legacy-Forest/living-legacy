import {
  type CalendarDate,
  MAX_OCCURRENCES,
  type RepeatKind,
  fromZoned,
  occurrenceDates,
  repeatKinds,
  repeatLabel,
  sameClockOn,
  toZoned,
} from '@ll/content';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTimeZone } from '@/lib/use-time-zone';
import { type EventTimes, dayLabel } from './event-dates-field';

export type RepeatValue = {
  repeat: RepeatKind;
  ends: 'count' | 'until';
  count: number;
  until: CalendarDate | null;
  /** Dates left out of the series, as "2026-11-14". */
  skipped: string[];
  /** Weekly patterns: the days besides the first date's (0 Sunday to 6 Saturday). */
  weekdays: number[];
  /** "On dates you pick": the other dates. */
  picked: CalendarDate[];
};

export const noRepeat: RepeatValue = {
  repeat: 'none',
  ends: 'count',
  count: 6,
  until: null,
  skipped: [],
  weekdays: [],
  picked: [],
};

const key = (d: CalendarDate) => `${d.year}-${d.month + 1}-${d.day}`;

/** Monday first, as Australian calendars are. */
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((day) => {
  const name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]!;
  return { day, name, short: name.slice(0, 2) };
});

/** Every date the series makes, with its times and whether it was left out. */
export function seriesDates(first: EventTimes, value: RepeatValue, zone: string) {
  const firstDay = toZoned(first.startsAt, zone);
  const dates = occurrenceDates(
    firstDay,
    value.repeat,
    value.ends === 'count' ? { count: value.count } : { until: value.until },
    { weekdays: value.weekdays, dates: value.picked }
  );
  return dates.map((d, i) => ({
    key: key(d),
    date: d,
    first: i === 0,
    skipped: i > 0 && value.skipped.includes(key(d)),
    // Noon marks the day; the times come from the first date's clock times.
    ...sameClockOn(fromZoned({ ...d, hour: 12, minute: 0 }, zone), first, zone),
  }));
}

/** Repeats for a new event: the pattern, when it ends, and which dates to leave out. */
export function RepeatField({
  first,
  value,
  onChange,
}: {
  first: EventTimes | null;
  value: RepeatValue;
  onChange: (value: RepeatValue) => void;
}) {
  const zone = useTimeZone();
  const [untilOpen, setUntilOpen] = useState(false);
  const patch = (next: Partial<RepeatValue>) => onChange({ ...value, ...next });

  if (!first) {
    return <p className="text-muted-foreground text-xs">Pick a date first to make it repeat.</p>;
  }
  const firstDay = toZoned(first.startsAt, zone);
  const items = repeatKinds.map((kind) => ({
    value: kind,
    label: repeatLabel(kind, firstDay, value.weekdays),
  }));
  const firstWeekday = new Date(Date.UTC(firstDay.year, firstDay.month, firstDay.day)).getUTCDay();
  const weekly = value.repeat === 'weekly' || value.repeat === 'fortnightly';
  const custom = value.repeat === 'custom';
  const dates = value.repeat === 'none' ? [] : seriesDates(first, value, zone);
  const kept = dates.filter((d) => !d.skipped).length;

  return (
    <div className="space-y-3">
      {/* Stacked: a pattern like "Every 2 weeks on Monday, Wednesday and Saturday" needs the width. */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ev-repeat">Repeats</Label>
          <Select
            items={items}
            value={value.repeat}
            onValueChange={(next) => next && patch({ repeat: next as RepeatKind, skipped: [] })}
          >
            <SelectTrigger id="ev-repeat" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value.repeat !== 'none' && !custom && (
          <div className="space-y-1.5">
            <Label htmlFor="ev-repeat-ends">Ends</Label>
            <div className="flex max-w-sm gap-2">
              <Select
                items={[
                  { value: 'count', label: 'After' },
                  { value: 'until', label: 'On' },
                ]}
                value={value.ends}
                onValueChange={(next) => next && patch({ ends: next as RepeatValue['ends'] })}
              >
                <SelectTrigger id="ev-repeat-ends" className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">After</SelectItem>
                  <SelectItem value="until">On</SelectItem>
                </SelectContent>
              </Select>
              {value.ends === 'count' ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    aria-label="Number of dates"
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={MAX_OCCURRENCES}
                    value={value.count}
                    onChange={(e) =>
                      patch({
                        count: Math.min(MAX_OCCURRENCES, Math.max(2, Number(e.target.value) || 2)),
                      })
                    }
                    className="w-20"
                  />
                  <span className="text-muted-foreground text-sm">dates</span>
                </div>
              ) : (
                <Popover open={untilOpen} onOpenChange={setUntilOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start px-2.5 font-normal"
                      />
                    }
                  >
                    {value.until ? dayLabel(value.until) : 'Pick a date'}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[20rem] p-0">
                    <Calendar
                      weekStartsOn={1}
                      className="w-full px-3"
                      classNames={{ root: 'w-full' }}
                      mode="single"
                      selected={
                        value.until
                          ? new Date(value.until.year, value.until.month, value.until.day)
                          : undefined
                      }
                      disabled={{ before: new Date(firstDay.year, firstDay.month, firstDay.day) }}
                      onSelect={(d) => {
                        if (!d) return;
                        patch({
                          until: { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() },
                        });
                        setUntilOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        )}
      </div>

      {weekly && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">On</legend>
          <div className="flex gap-1">
            {WEEK.map(({ day, short, name }) => {
              const isFirst = day === firstWeekday;
              const on = isFirst || value.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={name}
                  aria-pressed={on}
                  disabled={isFirst}
                  title={isFirst ? 'The first date falls on this day' : undefined}
                  onClick={() =>
                    patch({
                      skipped: [],
                      weekdays: on
                        ? value.weekdays.filter((d) => d !== day)
                        : [...value.weekdays, day],
                    })
                  }
                  className={cn(
                    'touch:size-11 size-9 rounded-full border text-xs font-medium transition-colors',
                    on ? 'bg-primary text-primary-foreground border-transparent' : 'hover:bg-muted'
                  )}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {custom && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">Dates</p>
            {value.picked.length > 0 && (
              <button
                type="button"
                onClick={() => patch({ picked: [] })}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Clear
              </button>
            )}
          </div>
          {/* The first date shows as chosen and stays so; tapping others adds or removes them. */}
          <div className="rounded-lg border">
            <Calendar
              mode="multiple"
              weekStartsOn={1}
              className="w-full px-3"
              // A gap between days, so chosen dates sit apart rather than as one block.
              classNames={{
                root: 'w-full',
                weekdays: 'flex gap-1.5',
                week: 'mt-1.5 flex w-full gap-1.5',
              }}
              selected={[firstDay, ...value.picked].map((d) => new Date(d.year, d.month, d.day))}
              defaultMonth={new Date(firstDay.year, firstDay.month, firstDay.day)}
              disabled={{ before: new Date(firstDay.year, firstDay.month, firstDay.day) }}
              onSelect={(days) =>
                patch({
                  picked: (days ?? [])
                    .map((d) => ({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }))
                    .filter((d) => key(d) !== key(firstDay)),
                })
              }
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {kept === 1
              ? 'Tap the other dates it runs on. Each gets the same times and its own guest list.'
              : `${kept} dates, each with the same times and its own guest list.`}
          </p>
        </div>
      )}

      {value.repeat !== 'none' && !custom && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {value.ends === 'until' && !value.until
              ? 'Pick when it ends to see the dates.'
              : `${kept} ${kept === 1 ? 'date' : 'dates'}, each with its own guest list. Tap a date to leave it out.`}
          </p>
          {(value.ends === 'count' || value.until) && (
            <ul className="flex flex-wrap gap-1.5">
              {dates.map((d) => (
                <li key={d.key}>
                  <button
                    type="button"
                    disabled={d.first}
                    aria-pressed={!d.skipped}
                    onClick={() =>
                      patch({
                        skipped: d.skipped
                          ? value.skipped.filter((k) => k !== d.key)
                          : [...value.skipped, d.key],
                      })
                    }
                    className={cn(
                      'touch:min-h-11 rounded-md border px-2 py-1 text-xs tabular-nums transition-colors',
                      d.skipped
                        ? 'text-muted-foreground border-dashed line-through'
                        : 'bg-muted/60 border-transparent',
                      d.first && 'cursor-default'
                    )}
                  >
                    {new Date(Date.UTC(d.date.year, d.date.month, d.date.day)).toLocaleDateString(
                      'en-AU',
                      { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

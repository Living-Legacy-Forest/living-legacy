import { type CalendarDate, toZoned } from '@ll/content';
import { useState } from 'react';
import { type DateRange } from 'react-day-picker';
import { CalendarClockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { displayTime, fromZoned, parseTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';

export type EventTimes = { startsAt: number; endsAt: number };

const asDate = (d: CalendarDate) => new Date(d.year, d.month, d.day);
const asCalendar = (d: Date): CalendarDate => ({
  year: d.getFullYear(),
  month: d.getMonth(),
  day: d.getDate(),
});
const sameDay = (a: CalendarDate, b: CalendarDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

/** "14 Nov 2026", or "14 to 15 Nov 2026" for two days. */
export function dayLabel(from: CalendarDate, to?: CalendarDate | null) {
  const fmt = (d: CalendarDate, opts: Intl.DateTimeFormatOptions) =>
    new Date(Date.UTC(d.year, d.month, d.day)).toLocaleDateString('en-AU', {
      timeZone: 'UTC',
      ...opts,
    });
  const full = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  if (!to || sameDay(from, to)) return fmt(from, full);
  const sameMonth = from.month === to.month && from.year === to.year;
  return `${fmt(from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} to ${fmt(to, full)}`;
}

/**
 * When an event happens: a day (or two, for a multi-day event) and its start
 * and end times, in the site's time zone. Reports both timestamps once all
 * three are set.
 */
export function EventDatesField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: { startsAt: number | null; endsAt: number | null };
  onChange: (times: EventTimes) => void;
}) {
  const zone = useTimeZone();
  const start = value.startsAt === null ? null : toZoned(value.startsAt, zone);
  const end = value.endsAt === null ? null : toZoned(value.endsAt, zone);
  const [range, setRange] = useState<{ from: CalendarDate; to: CalendarDate } | null>(
    start && end ? { from: start, to: end } : null
  );
  const [startText, setStartText] = useState(
    start ? displayTime(`${start.hour}:${start.minute}`) : '10:00 am'
  );
  const [endText, setEndText] = useState(
    end ? displayTime(`${end.hour}:${end.minute}`) : '12:00 pm'
  );
  const [open, setOpen] = useState(false);

  function report(next: { from: CalendarDate; to: CalendarDate } | null, s: string, e: string) {
    const startTime = parseTime(s);
    const endTime = parseTime(e);
    if (!next || !startTime || !endTime) return;
    const [sh = 0, sm = 0] = startTime.split(':').map(Number);
    const [eh = 0, em = 0] = endTime.split(':').map(Number);
    onChange({
      startsAt: fromZoned({ ...next.from, hour: sh, minute: sm }, zone),
      endsAt: fromZoned({ ...next.to, hour: eh, minute: em }, zone),
    });
  }

  function pickRange(picked: DateRange | undefined) {
    if (!picked?.from) return;
    const next = { from: asCalendar(picked.from), to: asCalendar(picked.to ?? picked.from) };
    setRange(next);
    report(next, startText, endText);
  }

  /** Tidies a typed time to "10:30 am" and applies it, or puts back the last good one. */
  function settle(text: string, setText: (t: string) => void, which: 'start' | 'end') {
    const parsed = parseTime(text);
    const fallback = which === 'start' ? startText : endText;
    const shown = parsed ? displayTime(parsed) : fallback;
    setText(shown);
    report(range, which === 'start' ? shown : startText, which === 'end' ? shown : endText);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_7.5rem_7.5rem]">
      <div className="space-y-1.5">
        <Label htmlFor={id}>Date</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={id}
                type="button"
                variant="outline"
                className="w-full justify-start px-2.5 font-normal"
              />
            }
          >
            <CalendarClockIcon aria-hidden data-icon="inline-start" />
            <span className="truncate">
              {range ? dayLabel(range.from, range.to) : 'Pick a date'}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[20rem] p-0">
            {/* The calendar fills the popover, so the hint below wraps under it. */}
            <Calendar
              className="w-full px-3"
              classNames={{ root: 'w-full' }}
              mode="range"
              selected={range ? { from: asDate(range.from), to: asDate(range.to) } : undefined}
              defaultMonth={range ? asDate(range.from) : undefined}
              onSelect={pickRange}
              min={0}
            />
            <p className="text-muted-foreground border-t px-3 py-2 text-xs">
              Pick one day, or a second day for an event over two or more days.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-start`}>Starts</Label>
        <Input
          id={`${id}-start`}
          value={startText}
          onChange={(e) => setStartText(e.target.value)}
          onBlur={(e) => settle(e.target.value, setStartText, 'start')}
          placeholder="10:00 am"
          inputMode="text"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-end`}>Ends</Label>
        <Input
          id={`${id}-end`}
          value={endText}
          onChange={(e) => setEndText(e.target.value)}
          onBlur={(e) => settle(e.target.value, setEndText, 'end')}
          placeholder="12:00 pm"
          inputMode="text"
        />
      </div>
    </div>
  );
}

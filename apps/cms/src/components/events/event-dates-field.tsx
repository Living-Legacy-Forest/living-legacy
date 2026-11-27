import { type CalendarDate, toZoned } from '@ll/content';
import { useState } from 'react';
import { XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL } from '@/components/form-cells';
import { Label } from '@/components/ui/label';
import { displayTime, fromZoned, parseTime, sameDate } from '@/lib/format';

export type EventTimes = { startsAt: number; endsAt: number };

/** Another time on the same day, as typed: "2:00 pm" to "4:00 pm". */
export type SessionTime = { start: string; end: string };

const clock = (text: string) => {
  const t = parseTime(text);
  if (!t) return null;
  const [hour = 0, minute = 0] = t.split(':').map(Number);
  return { hour, minute };
};

/** An extra session's times on the first date, or null if its times don't read or run backwards. */
export function sessionTimes(
  firstStartsAt: number,
  session: SessionTime,
  zone: string
): EventTimes | null {
  const start = clock(session.start);
  const end = clock(session.end);
  if (!start || !end) return null;
  const day = toZoned(firstStartsAt, zone);
  const times = {
    startsAt: fromZoned({ ...day, ...start }, zone),
    endsAt: fromZoned({ ...day, ...end }, zone),
  };
  return times.endsAt > times.startsAt ? times : null;
}

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
    sameDate(
      new Date(Date.UTC(d.year, d.month, d.day)).toLocaleDateString('en-AU', {
        timeZone: 'UTC',
        ...opts,
      })
    );
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
  zone,
  value,
  onChange,
  sessions,
  onSessionsChange,
}: {
  id: string;
  /** The event's time zone. */
  zone: string;
  value: { startsAt: number | null; endsAt: number | null };
  onChange: (times: EventTimes) => void;
  /** Extra times on each date, for a new event; each becomes its own event. */
  sessions?: SessionTime[];
  onSessionsChange?: (sessions: SessionTime[]) => void;
}) {
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

  function pickRange(picked: DateRange) {
    const next = { from: asCalendar(picked.start), to: asCalendar(picked.end) };
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

  const setSession = (i: number, next: Partial<SessionTime>) =>
    onSessionsChange?.((sessions ?? []).map((x, k) => (k === i ? { ...x, ...next } : x)));
  /** Tidies a typed session time, or leaves it for the save check to flag. */
  const tidy = (text: string) => {
    const parsed = parseTime(text);
    return parsed ? displayTime(parsed) : text;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_7.5rem_7.5rem]">
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor={id} className={FIELD_LABEL}>
            Date
          </Label>
          <DateRangePicker
            id={id}
            label="Date"
            placeholder="Pick a date"
            value={range ? { start: asDate(range.from), end: asDate(range.to) } : null}
            onChange={pickRange}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-start`} className={FIELD_LABEL}>
            Starts
          </Label>
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
          <Label htmlFor={`${id}-end`} className={FIELD_LABEL}>
            Ends
          </Label>
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

      {(sessions ?? []).map((session, i) => (
        <div
          key={i}
          className="animate-in fade-in slide-in-from-top-1 grid grid-cols-2 items-center gap-3 duration-200 motion-reduce:animate-none sm:grid-cols-[1fr_7.5rem_7.5rem]"
        >
          <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
            <span className="text-muted-foreground text-sm">Also at</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove time ${i + 2}`}

              onClick={() => onSessionsChange?.((sessions ?? []).filter((_, k) => k !== i))}
            >
              <XIcon aria-hidden />
            </Button>
          </div>
          <Input
            aria-label={`Time ${i + 2} starts`}
            value={session.start}
            onChange={(e) => setSession(i, { start: e.target.value })}
            onBlur={(e) => setSession(i, { start: tidy(e.target.value) })}
            placeholder="2:00 pm"
          />
          <Input
            aria-label={`Time ${i + 2} ends`}
            value={session.end}
            onChange={(e) => setSession(i, { end: e.target.value })}
            onBlur={(e) => setSession(i, { end: tidy(e.target.value) })}
            placeholder="4:00 pm"
          />
        </div>
      ))}

      {onSessionsChange && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
          onClick={() => onSessionsChange([...(sessions ?? []), { start: '', end: '' }])}
        >
          Add another time
        </Button>
      )}
    </div>
  );
}

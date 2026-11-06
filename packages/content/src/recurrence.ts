import { fromZoned, toZoned } from './zoned';

// Repeating events: the dates of a series, and their times in the site's time
// zone. Each date becomes its own event (own capacity and guest list), linked
// by a series id. Months are 0-based, as in Date.

export type CalendarDate = { year: number; month: number; day: number };

export const repeatKinds = [
  'none',
  'weekly',
  'fortnightly',
  'monthly_weekday',
  'monthly_date',
] as const;
export type RepeatKind = (typeof repeatKinds)[number];

/** The most dates one series makes: a year of weekly events. */
export const MAX_OCCURRENCES = 52;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const utcDay = (d: CalendarDate) => Date.UTC(d.year, d.month, d.day);
const fromUtcDay = (ms: number): CalendarDate => {
  const x = new Date(ms);
  return { year: x.getUTCFullYear(), month: x.getUTCMonth(), day: x.getUTCDate() };
};
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
const weekdayOf = (d: CalendarDate) => new Date(utcDay(d)).getUTCDay();

/** Which of its weekday in the month a date is: 1 to 4, or -1 for the last (a 5th). */
function weekdayPosition(d: CalendarDate): number {
  const nth = Math.ceil(d.day / 7);
  return nth === 5 ? -1 : nth;
}

function nthWeekday(year: number, month: number, weekday: number, nth: number): CalendarDate {
  if (nth === -1) {
    const last = daysInMonth(year, month);
    const lastWeekday = new Date(Date.UTC(year, month, last)).getUTCDay();
    return { year, month, day: last - ((lastWeekday - weekday + 7) % 7) };
  }
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return { year, month, day: 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7 };
}

/**
 * The dates of a series from its first date, up to `count` dates or until
 * `until` (inclusive), and never more than MAX_OCCURRENCES.
 */
export function occurrenceDates(
  first: CalendarDate,
  repeat: RepeatKind,
  end: { count?: number | null; until?: CalendarDate | null }
): CalendarDate[] {
  if (repeat === 'none') return [first];
  const limit = Math.min(end.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const until = end.until ? utcDay(end.until) : Infinity;
  const dates: CalendarDate[] = [];

  // Bounded so a pattern that rarely lands (the 31st) cannot run forever.
  for (let i = 0; dates.length < limit && i < MAX_OCCURRENCES * 2; i++) {
    let date: CalendarDate | null;
    if (repeat === 'weekly' || repeat === 'fortnightly') {
      date = fromUtcDay(utcDay(first) + i * (repeat === 'weekly' ? 7 : 14) * DAY_MS);
    } else {
      const month = first.month + i;
      const year = first.year + Math.floor(month / 12);
      const m = month % 12;
      date =
        repeat === 'monthly_weekday'
          ? nthWeekday(year, m, weekdayOf(first), weekdayPosition(first))
          : first.day <= daysInMonth(year, m)
            ? { year, month: m, day: first.day }
            : null;
    }
    if (!date) continue;
    if (utcDay(date) > until) break;
    dates.push(date);
  }
  return dates;
}

/** "10:00", "1030", "9:30 am" or "2p" as a 24-hour clock time, or null. */
export function parseClock(text: string): { hour: number; minute: number } | null {
  const m = text
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const half = m[3]?.[0];
  if (minute > 59) return null;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (half === 'p' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute };
}

/** Start and end timestamps for each date, at the given clock times in `zone`. */
export function occurrenceTimes(
  dates: CalendarDate[],
  opts: { startTime: string; endTime: string; spanDays: number; zone: string }
): { startsAt: number; endsAt: number }[] {
  const start = parseClock(opts.startTime);
  const end = parseClock(opts.endTime);
  if (!start || !end) throw new Error('Times must look like 10:00 or 2:30 pm.');
  return dates.map((date) => {
    const last = fromUtcDay(utcDay(date) + opts.spanDays * DAY_MS);
    return {
      startsAt: fromZoned({ ...date, ...start }, opts.zone),
      endsAt: fromZoned({ ...last, ...end }, opts.zone),
    };
  });
}

/**
 * Another date of a series, given the edited date's new times: the same clock
 * times and length in days, on that date's own day ("this and upcoming dates").
 */
export function sameClockOn(
  startsAt: number,
  edited: { startsAt: number; endsAt: number },
  zone: string
): { startsAt: number; endsAt: number } {
  const start = toZoned(edited.startsAt, zone);
  const end = toZoned(edited.endsAt, zone);
  const spanDays = Math.round((utcDay(end) - utcDay(start)) / DAY_MS);
  const day = toZoned(startsAt, zone);
  const last = fromUtcDay(utcDay(day) + spanDays * DAY_MS);
  return {
    startsAt: fromZoned({ ...day, hour: start.hour, minute: start.minute }, zone),
    endsAt: fromZoned({ ...last, hour: end.hour, minute: end.minute }, zone),
  };
}

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/** How a series repeats, worded from its first date. */
export function repeatLabel(repeat: RepeatKind, first: CalendarDate): string {
  const weekday = WEEKDAYS[weekdayOf(first)];
  switch (repeat) {
    case 'none':
      return 'Does not repeat';
    case 'weekly':
      return `Every ${weekday}`;
    case 'fortnightly':
      return `Every 2 weeks on ${weekday}`;
    case 'monthly_weekday': {
      const nth = weekdayPosition(first);
      return `Monthly on the ${nth === -1 ? 'last' : ordinal(nth)} ${weekday}`;
    }
    case 'monthly_date':
      return `Monthly on the ${ordinal(first.day)}`;
  }
}

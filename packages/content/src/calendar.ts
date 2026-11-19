// The content calendar's month maths, kept pure so it is tested without a database or a browser.
// Months are 0-based, as in Date (10 is November), and weeks start on Monday.
import { toZoned } from './zoned';

export type CalendarMonth = { year: number; month: number };

export type CalendarDay = { year: number; month: number; day: number };

/** A day of the month grid; days of the neighbouring months fill the first and last weeks. */
export type GridDay = CalendarDay & { inMonth: boolean };

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11" for November 2026: how the month is written in the address. */
export function monthKey({ year, month }: CalendarMonth): string {
  return `${year}-${pad(month + 1)}`;
}

/** The month a "YYYY-MM" names, or null if it is not one. */
export function parseMonthKey(value: string | undefined | null): CalendarMonth | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  // Far enough either side to be a real date, and a sane thing to fetch.
  if (year < 2000 || year > 2100) return null;
  return { year, month: Number(match[2]) - 1 };
}

export function shiftMonth({ year, month }: CalendarMonth, by: number): CalendarMonth {
  const index = year * 12 + month + by;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** "2026-11-05", to key a day in a map. */
export function dayKey({ year, month, day }: CalendarDay): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** The weeks that show the month, Monday first, each of seven days. */
export function monthGrid({ year, month }: CalendarMonth): GridDay[][] {
  // Date.UTC rolls days over month ends for us, so no calendar is hard-coded here.
  const first = Date.UTC(year, month, 1);
  const mondayOffset = (new Date(first).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);
  const start = first - mondayOffset * DAY_MS;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start + (w * 7 + d) * DAY_MS);
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month && date.getUTCFullYear() === year,
      };
    })
  );
}

/**
 * The instants to fetch for a month: its grid, plus a day either side so an item that falls on
 * the grid's edge in its own time zone is never missed. Callers still place items by day.
 */
export function monthWindow(month: CalendarMonth): { from: number; to: number } {
  const weeks = monthGrid(month);
  const first = weeks[0]![0]!;
  const last = weeks[weeks.length - 1]![6]!;
  return {
    from: Date.UTC(first.year, first.month, first.day) - DAY_MS,
    to: Date.UTC(last.year, last.month, last.day) + 2 * DAY_MS,
  };
}

/**
 * Items grouped by the day they fall on, soonest first within a day. Each is placed in its own
 * zone (an event's) or, without one, in `siteZone`: an item at 11 pm in Perth is that evening,
 * not the next morning in Melbourne.
 */
export function bucketByDay<T extends { at: number; timeZone?: string | null }>(
  items: readonly T[],
  siteZone: string
): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.at - b.at)) {
    const wall = toZoned(item.at, item.timeZone || siteZone);
    const key = dayKey(wall);
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return days;
}

const LOCALE = 'en-AU';

/** Noon anchor avoids off-by-one labels around timezone boundaries for ISO date strings. */
function parseIsoCalendarDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

/** Chart axis label for a day: "21 Oct". */
export function formatChartAxisTick(isoDate: string): string {
  return parseIsoCalendarDate(isoDate).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
  });
}

/** Chart tooltip label for a run of days: "21 to 27 Oct 2026", or one day on its own. */
export function formatChartRange(startIso: string, endIso: string): string {
  const start = parseIsoCalendarDate(startIso);
  const end = parseIsoCalendarDate(endIso);
  const full = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  if (startIso === endIso) return end.toLocaleDateString(LOCALE, full);
  const from = start.toLocaleDateString(
    LOCALE,
    start.getFullYear() !== end.getFullYear()
      ? full
      : start.getMonth() !== end.getMonth()
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric' }
  );
  return `${from} to ${end.toLocaleDateString(LOCALE, full)}`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

// Made on first use: building it loads locale data, which at module load would
// slow every Worker start, including ones that never format a date.
let relative: Intl.RelativeTimeFormat | undefined;
const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function formatRelative(timestamp: number, now = Date.now()) {
  const diff = timestamp - now;
  for (const [unit, ms] of steps) {
    if (Math.abs(diff) >= ms) {
      relative ??= new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
      return relative.format(Math.round(diff / ms), unit);
    }
  }
  return 'just now';
}

/** `zone` is the site's configured time zone (Settings → Language & appearance). */
export function formatDate(timestamp: number, zone: string) {
  return new Date(timestamp).toLocaleDateString(LOCALE, {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(timestamp: number, zone: string) {
  return new Date(timestamp).toLocaleString(LOCALE, {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Shared with the event rules, which need the same conversions.
export { type WallTime, fromZoned, toZoned } from '@ll/content';

/** Short name of `zone` right now, for example "AEDT". */
export function zoneName(zone: string, timestamp = Date.now()) {
  return (
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date(timestamp))
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
  );
}

/**
 * GMT offset of `zone` right now, for example "GMT+11" or "GMT+9:30".
 * Varies by zone and, for zones that observe it, by daylight saving.
 */
export function zoneOffset(zone: string, timestamp = Date.now()) {
  return (
    new Intl.DateTimeFormat(LOCALE, { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date(timestamp))
      .find((p) => p.type === 'timeZoneName')?.value ?? ''
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Reads times typed the way people write them: "9", "9am", "9:30 pm",
 * "21:10", "0930". Returns 24-hour "HH:MM", or null if it is not a time.
 */
export function parseTime(text: string): string | null {
  const match = text
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(a|am|p|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.[0];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === 'p' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** "21:10" becomes "9:10 pm", the way Australians write times. */
export function displayTime(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${pad2(minute)} ${hour < 12 ? 'am' : 'pm'}`;
}

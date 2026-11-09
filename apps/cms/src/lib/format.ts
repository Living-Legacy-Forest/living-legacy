import { parseClock } from '@ll/content';

const LOCALE = 'en-AU';

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

/** "Saturday 14 March 2027" in `zone`. */
export function formatLongDate(timestamp: number, zone: string) {
  return new Date(timestamp).toLocaleDateString(LOCALE, {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "10:00 am – 12:00 pm", naming the end's day when it is not the start's. */
export function formatTimeRange(start: number, end: number, zone: string) {
  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString(LOCALE, { timeZone: zone, hour: 'numeric', minute: '2-digit' });
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString(LOCALE, {
      timeZone: zone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  return day(start) === day(end)
    ? `${time(start)} – ${time(end)}`
    : `${day(start)}, ${time(start)} – ${day(end)}, ${time(end)}`;
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
/** Typed time ("10:30", "2pm") as "HH:MM", or null. */
export function parseTime(text: string): string | null {
  const t = parseClock(text);
  return t ? `${pad2(t.hour)}:${pad2(t.minute)}` : null;
}

export function displayTime(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${pad2(minute)} ${hour < 12 ? 'am' : 'pm'}`;
}

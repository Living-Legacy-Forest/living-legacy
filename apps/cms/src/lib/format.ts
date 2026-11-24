import { parseClock } from '@ll/content';

const LOCALE = 'en-AU';

export function formatInteger(value: number) {
  return new Intl.NumberFormat(LOCALE).format(value);
}

const compactNumber = new Intl.NumberFormat(LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** A short number for an axis: "950", "1.2K", "12K", "1.5M". The full figure belongs in a tooltip. */
export function formatCompact(value: number) {
  return compactNumber.format(value);
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

/** A run time: milliseconds under a second, then seconds, then minutes. */
export function formatDuration(ms: number) {
  if (ms < 1000) return `${formatInteger(Math.round(ms))} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(seconds)} s`;
  }
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(seconds / 60)} min`;
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

/**
 * The same short date from every engine. Browsers word en-AU dates differently: V8 (the
 * Worker, Chrome) writes "18 Sept" and "Fri 18 Sept", Safari's engine "18 Sep" and
 * "Fri, 18 Sep". A page is rendered on the server and again in the browser, and text that
 * differs makes React throw the server's HTML away, so every short date settles on V8's form.
 */
export function sameDate(text: string) {
  return text.replace(/\bSep\b/g, 'Sept').replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /, '$1 ');
}

/** `zone` is the site's configured time zone (Settings → Language & appearance). */
export function formatDate(timestamp: number, zone: string) {
  return sameDate(
    new Date(timestamp).toLocaleDateString(LOCALE, {
      timeZone: zone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  );
}

/** "18 Sept 2026, 1:05 pm". Put together here: Safari joins the two with "at". */
export function formatDateTime(timestamp: number, zone: string) {
  const time = new Date(timestamp).toLocaleTimeString(LOCALE, {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${formatDate(timestamp, zone)}, ${time}`;
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
    sameDate(
      new Date(ms).toLocaleDateString(LOCALE, {
        timeZone: zone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    );
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

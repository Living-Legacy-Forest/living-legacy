export const LOCALE = 'en-AU';

/** Noon anchor avoids off-by-one labels around timezone boundaries for ISO date strings. */
export function parseIsoCalendarDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

export function formatChartAxisTick(isoDate: string, periodDays: number): string {
  const date = parseIsoCalendarDate(isoDate);
  return periodDays > 60
    ? date.toLocaleDateString(LOCALE, { month: 'short' })
    : date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function formatChartTooltipDate(isoDate: string): string {
  return parseIsoCalendarDate(isoDate).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
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
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

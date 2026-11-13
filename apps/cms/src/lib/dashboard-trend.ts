// The dashboard's trend card: which numbers it can show, over which ranges, and how a
// timestamp lands on a day. Plain data and functions, shared by the server and the card.

export const trendMetrics = {
  // Distinct browsers. Its total counts each one once, not once for every day they came back.
  visitors: { label: 'Unique visitors', total: 'Total unique visitors' },
  pageviews: { label: 'Page views', total: 'Total page views' },
} as const;

export type TrendMetric = keyof typeof trendMetrics;
export const trendMetricKeys = Object.keys(trendMetrics) as TrendMetric[];

export const trendRanges = [7, 30, 90] as const;
export type TrendRange = (typeof trendRanges)[number];

const keyFormat = new Map<string, Intl.DateTimeFormat>();

/** "2026-11-13": the calendar date of `timestamp` in `zone`. */
export function dayKey(timestamp: number, zone: string) {
  let format = keyFormat.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone: zone });
    keyFormat.set(zone, format);
  }
  return format.format(timestamp);
}

/** The `count` calendar dates ending today in `zone`, oldest first. */
export function dayKeys(count: number, zone: string, now = Date.now()) {
  const [year, month, day] = dayKey(now, zone).split('-').map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(year, month - 1, day - (count - 1 - i))).toISOString().slice(0, 10)
  );
}

/** Adds each reading to its day; days outside `keys` are dropped. */
export function bucketByDay(keys: string[], readings: { day: string; value: number }[]): number[] {
  const index = new Map(keys.map((key, i) => [key, i]));
  const totals = keys.map(() => 0);
  for (const { day, value } of readings) {
    const i = index.get(day);
    if (i !== undefined) totals[i]! += value;
  }
  return totals;
}

/** The change from one period to the next, or null when there was nothing before to compare. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Day keys are calendar dates, so format them as UTC to keep the date as written.
const dateOf = (key: string) => new Date(`${key}T00:00:00Z`);
/** "3 Nov". */
export const shortDate = (key: string) =>
  dateOf(key).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short' });
/** "Tue, 3 Nov". */
export const longDate = (key: string) =>
  dateOf(key).toLocaleDateString('en-AU', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/** Every few days on the axis; the chart thins them further to fit. */
export const axisEvery = (days: number) => (days <= 7 ? 1 : days <= 30 ? 7 : 14);

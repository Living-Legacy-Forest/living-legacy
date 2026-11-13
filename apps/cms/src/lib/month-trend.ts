/** Calendar months for the stat cards' trend, in the site's time zone. */

export const TREND_MONTHS = 12;

/** How far ahead of UTC the zone is at `at`, in milliseconds. */
export function zoneOffsetMs(at: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, Number(p.value)])
  );
  const local = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!
  );
  return local - Math.floor(at / 1000) * 1000;
}

/** "2026-11", oldest first, ending with the month `at` falls in once `offsetMs` is added. */
export function monthKeys(at: number, offsetMs: number, count = TREND_MONTHS) {
  const now = new Date(at + offsetMs);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** When a month starts, as a real moment: its midnight in the zone, not in UTC. */
export function monthStartMs(key: string, offsetMs: number) {
  const [year, month] = key.split('-').map(Number);
  return Date.UTC(year!, month! - 1, 1) - offsetMs;
}

/** Counts per month in `keys` order; months with no rows are zero. */
export function toMonths(rows: { month: string; n: number }[], keys: string[]) {
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.n)]));
  return keys.map((key) => byMonth.get(key) ?? 0);
}

const labelOf = (key: string, options: Intl.DateTimeFormatOptions) => {
  const [year, month] = key.split('-').map(Number);
  // A month is a calendar fact, so format it as UTC to keep it as written.
  return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString('en-AU', {
    timeZone: 'UTC',
    ...options,
  });
};

/** "November 2026". */
export const monthName = (key: string) => labelOf(key, { month: 'long', year: 'numeric' });
/** "Nov". */
export const monthShort = (key: string) => labelOf(key, { month: 'short' });

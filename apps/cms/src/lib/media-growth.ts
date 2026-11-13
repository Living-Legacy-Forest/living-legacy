import { bucketByDay, dayKey } from './dashboard-trend';

/** Files and bytes added per day, oldest first, one entry per key. */
export type Growth = { keys: string[]; files: number[]; bytes: number[] };

/** Uploads bucketed into the calendar days `keys` (in `timeZone`); uploads outside them are left out. */
export function growthOf(
  uploads: { at: Date | null; bytes: number }[],
  keys: string[],
  timeZone: string
): Growth {
  const dated = uploads.flatMap((u) =>
    u.at ? [{ day: dayKey(u.at.getTime(), timeZone), bytes: u.bytes }] : []
  );
  return {
    keys,
    files: bucketByDay(
      keys,
      dated.map((u) => ({ day: u.day, value: 1 }))
    ),
    bytes: bucketByDay(
      keys,
      dated.map((u) => ({ day: u.day, value: u.bytes }))
    ),
  };
}

/** What was added in the last `days` days. */
export function addedIn(growth: Growth, days: number) {
  const sum = (values: number[]) => values.slice(-days).reduce((n, v) => n + v, 0);
  return { files: sum(growth.files), bytes: sum(growth.bytes) };
}

/**
 * How long until `usedBytes` reaches `allowanceBytes` if the library keeps growing at the rate of
 * the last `days` days, in months; null when it did not grow, so there is no pace to go on.
 */
export function monthsUntilFull(
  allowanceBytes: number,
  usedBytes: number,
  addedBytes: number,
  days: number
) {
  if (addedBytes <= 0) return null;
  const perMonth = (addedBytes / days) * 30.4;
  return Math.max(0, allowanceBytes - usedBytes) / perMonth;
}

/** "about 14 months", "about 3 years"; for a pace slow enough to stop mattering, "many years". */
export function describeMonths(months: number) {
  if (months < 1) return 'less than a month';
  if (months < 24) {
    const n = Math.round(months);
    return `about ${n} ${n === 1 ? 'month' : 'months'}`;
  }
  const years = months / 12;
  return years > 50 ? 'many years' : `about ${Math.round(years)} years`;
}

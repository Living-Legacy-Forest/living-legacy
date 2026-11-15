// A calendar day in a time zone, as the stretch of time it covers. The activity log stores
// moments in UTC; a day in the site's zone (Melbourne, say) starts at a different UTC hour
// through the year, so its bounds are worked out from the zone rather than assumed.

/** How far `zone`'s clock is ahead of UTC at the moment `at`, in ms. */
function offsetAt(zone: string, at: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
  return wall - Math.floor(at / 1000) * 1000;
}

/** The moment `key` (YYYY-MM-DD) begins in `zone`. */
function dayStart(key: string, zone: string) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const midnight = Date.UTC(y, m - 1, d);
  // Twice, so a day that starts just after a daylight-saving change still lands on its midnight.
  const first = midnight - offsetAt(zone, midnight);
  return midnight - offsetAt(zone, first);
}

/** Is `key` a real calendar date written YYYY-MM-DD? */
export const isDayKey = (key: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(key) && new Date(`${key}T00:00:00Z`).toISOString().startsWith(key);

/** From the start of `key` in `zone` to the start of the next day, in ms since 1970. */
export function zoneDayRange(key: string, zone: string): [number, number] {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return [dayStart(key, zone), dayStart(next, zone)];
}

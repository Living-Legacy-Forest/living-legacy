// Calendar dates and clock times in a named time zone (the site's, from
// Settings), to and from timestamps. Months are 0-based, as in Date.

export type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

/** Calendar date and clock time of `timestamp` in `zone`. */
export function toZoned(timestamp: number, zone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** Timestamp for a calendar date and clock time in `zone` (handles daylight saving). */
export function fromZoned(wall: WallTime, zone: string): number {
  const asUtc = Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute);
  let guess = asUtc;
  // Two passes settle the offset, including across a daylight saving change.
  for (let i = 0; i < 2; i++) {
    const seen = toZoned(guess, zone);
    const seenAsUtc = Date.UTC(seen.year, seen.month, seen.day, seen.hour, seen.minute);
    guess += asUtc - seenAsUtc;
  }
  return guess;
}

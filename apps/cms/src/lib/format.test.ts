import { afterEach, describe, expect, it } from 'vitest';
import {
  displayTime,
  formatBytes,
  formatCompact,
  formatDate,
  formatDateTime,
  formatRelative,
  formatTimeRange,
  parseTime,
  sameDate,
  zoneOffset,
} from './format';
import { setRegional } from './regional';

const MELBOURNE = 'Australia/Melbourne';

describe('formatCompact', () => {
  it('keeps hundreds whole and shortens from the thousands, so an axis label stays narrow', () => {
    expect([0, 25, 100, 950, 999].map(formatCompact)).toEqual(['0', '25', '100', '950', '999']);
    expect([1000, 1200, 12_500, 125_000, 1_500_000].map(formatCompact)).toEqual([
      '1K',
      '1.2K',
      '12.5K',
      '125K',
      '1.5M',
    ]);
  });
});

describe('sameDate', () => {
  it("turns Safari's wording into the server's, so a rendered page hydrates", () => {
    expect(sameDate('18 Sep 2026')).toBe('18 Sept 2026');
    expect(sameDate('Fri, 18 Sep')).toBe('Fri 18 Sept');
    expect(sameDate('Fri 18 Sept')).toBe('Fri 18 Sept');
  });

  it('leaves other words alone', () => {
    expect(sameDate('September 2026')).toBe('September 2026');
    expect(sameDate('Sun 14 Mar')).toBe('Sun 14 Mar');
  });
});

describe('formatBytes', () => {
  it('picks the largest unit that keeps the number at least 1', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('stops at GB', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3,072 GB');
  });
});

describe('formatRelative', () => {
  const now = Date.UTC(2026, 10, 8, 12);

  it('says "just now" under a minute', () => {
    expect(formatRelative(now - 30_000, now)).toBe('just now');
  });

  it('uses the largest whole unit, past and future', () => {
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(formatRelative(now + 2 * 3_600_000, now)).toBe('in 2 hours');
    expect(formatRelative(now - 86_400_000, now)).toBe('yesterday');
  });
});

describe('dates in the site time zone', () => {
  // 13:30 UTC on 31 Dec is already New Year's Day in Melbourne.
  const newYear = Date.UTC(2026, 11, 31, 13, 30);

  it('formats in the given zone, not the machine one', () => {
    expect(formatDate(newYear, MELBOURNE)).toBe('1 Jan 2027');
    expect(formatDate(newYear, 'UTC')).toBe('31 Dec 2026');
  });

  it('names the end day only when a range crosses midnight', () => {
    const start = Date.UTC(2027, 2, 13, 23); // 10:00 am, 14 March in Melbourne
    expect(formatTimeRange(start, start + 2 * 3_600_000, MELBOURNE)).toBe('10:00 am – 12:00 pm');
    // No comma after the weekday, whichever engine's locale data formatted it (sameDate).
    expect(formatTimeRange(start, start + 15 * 3_600_000, MELBOURNE)).toBe(
      'Sun 14 Mar, 10:00 am – Mon 15 Mar, 1:00 am'
    );
  });

  it('writes September and joins date and time the same way in every engine', () => {
    const september = Date.UTC(2026, 8, 18, 3, 5); // 1:05 pm, 18 September in Melbourne
    expect(formatDate(september, MELBOURNE)).toBe('18 Sept 2026');
    expect(formatDateTime(september, MELBOURNE)).toBe('18 Sept 2026, 1:05 pm');
  });

  it('follows daylight saving in the offset', () => {
    expect(zoneOffset(MELBOURNE, Date.UTC(2027, 0, 15))).toBe('GMT+11');
    expect(zoneOffset(MELBOURNE, Date.UTC(2027, 6, 15))).toBe('GMT+10');
    expect(zoneOffset('Australia/Adelaide', Date.UTC(2027, 6, 15))).toBe('GMT+9:30');
  });
});

describe('typed times', () => {
  it('reads the ways people write a time', () => {
    expect(parseTime('9')).toBe('09:00');
    expect(parseTime('9:30 pm')).toBe('21:30');
    expect(parseTime('2pm')).toBe('14:00');
    expect(parseTime('21:10')).toBe('21:10');
  });

  it('rejects text that is not a time', () => {
    expect(parseTime('lunch')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
  });

  it('displays 24-hour times on a 12-hour clock', () => {
    expect(displayTime('00:05')).toBe('12:05 am');
    expect(displayTime('12:00')).toBe('12:00 pm');
    expect(displayTime('21:30')).toBe('9:30 pm');
  });
});

describe("the site's date and time format", () => {
  // 18 Sept 2026, 1:05 pm in Melbourne.
  const at = Date.UTC(2026, 8, 18, 3, 5);
  afterEach(() => setRegional({ dateFormat: 'short', timeFormat: '12' }));

  it('writes a date as the site chose', () => {
    expect(formatDate(at, MELBOURNE)).toBe('18 Sept 2026');
    setRegional({ dateFormat: 'numeric', timeFormat: '12' });
    expect(formatDate(at, MELBOURNE)).toBe('18/09/2026');
    setRegional({ dateFormat: 'iso', timeFormat: '12' });
    expect(formatDate(at, MELBOURNE)).toBe('2026-09-18');
  });

  it('writes a time of day as 12 or 24 hours', () => {
    expect(formatDateTime(at, MELBOURNE)).toBe('18 Sept 2026, 1:05 pm');
    expect(displayTime('13:05')).toBe('1:05 pm');
    setRegional({ dateFormat: 'short', timeFormat: '24' });
    expect(formatDateTime(at, MELBOURNE)).toBe('18 Sept 2026, 13:05');
    expect(displayTime('13:05')).toBe('13:05');
    expect(displayTime('00:05')).toBe('00:05');
  });

  it('writes midnight as 12 am, or 00:00', () => {
    const midnight = Date.UTC(2026, 8, 17, 14, 0); // 00:00 on the 18th in Melbourne
    expect(formatDateTime(midnight, MELBOURNE)).toBe('18 Sept 2026, 12:00 am');
    setRegional({ dateFormat: 'short', timeFormat: '24' });
    expect(formatDateTime(midnight, MELBOURNE)).toBe('18 Sept 2026, 00:00');
  });
});

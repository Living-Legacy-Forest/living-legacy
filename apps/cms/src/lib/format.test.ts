import { describe, expect, it } from 'vitest';
import {
  displayTime,
  formatBytes,
  formatChartRange,
  formatDate,
  formatRelative,
  formatTimeRange,
  parseTime,
  zoneOffset,
} from './format';

const MELBOURNE = 'Australia/Melbourne';

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

describe('formatChartRange', () => {
  it('shows one day on its own', () => {
    expect(formatChartRange('2026-10-21', '2026-10-21')).toBe('21 Oct 2026');
  });

  it('drops the repeated month and year', () => {
    expect(formatChartRange('2026-10-21', '2026-10-27')).toBe('21 to 27 Oct 2026');
    expect(formatChartRange('2026-10-28', '2026-11-03')).toBe('28 Oct to 3 Nov 2026');
    expect(formatChartRange('2026-12-29', '2027-01-04')).toBe('29 Dec 2026 to 4 Jan 2027');
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
    // Versions of Node's locale data differ on the comma after the weekday.
    expect(formatTimeRange(start, start + 15 * 3_600_000, MELBOURNE)).toMatch(
      /^Sun,? 14 Mar, 10:00 am – Mon,? 15 Mar, 1:00 am$/
    );
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

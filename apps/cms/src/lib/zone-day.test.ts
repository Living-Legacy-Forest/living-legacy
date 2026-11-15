import { describe, expect, it } from 'vitest';
import { isDayKey, zoneDayRange } from './zone-day';

const iso = ([start, end]: [number, number]) => [
  new Date(start).toISOString(),
  new Date(end).toISOString(),
];

describe('zoneDayRange', () => {
  it('finds a Melbourne day in summer time and in winter', () => {
    expect(iso(zoneDayRange('2026-11-15', 'Australia/Melbourne'))).toEqual([
      '2026-11-14T13:00:00.000Z',
      '2026-11-15T13:00:00.000Z',
    ]);
    expect(iso(zoneDayRange('2026-06-15', 'Australia/Melbourne'))).toEqual([
      '2026-06-14T14:00:00.000Z',
      '2026-06-15T14:00:00.000Z',
    ]);
  });

  it('gives the day the clocks go forward its 23 hours', () => {
    const [start, end] = zoneDayRange('2026-10-04', 'Australia/Melbourne');
    expect((end - start) / 3_600_000).toBe(23);
  });

  it('works for UTC itself', () => {
    expect(iso(zoneDayRange('2026-01-01', 'UTC'))).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ]);
  });
});

describe('isDayKey', () => {
  it('takes real dates only', () => {
    expect(isDayKey('2026-11-15')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('15/11/2026')).toBe(false);
  });
});

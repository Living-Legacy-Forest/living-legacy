import { describe, expect, it } from 'vitest';
import { bucketByDay, dayKey, dayKeys, percentChange } from './dashboard-trend';

const zone = 'Australia/Melbourne';
// 13 Nov 2026, 9:30 am in Melbourne (daylight saving, UTC+11).
const now = Date.parse('2026-11-12T22:30:00Z');

describe('dayKeys', () => {
  it('lists the days ending today in the zone, oldest first', () => {
    expect(dayKeys(3, zone, now)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('crosses a month end', () => {
    expect(dayKeys(2, zone, Date.parse('2026-11-30T22:00:00Z'))).toEqual([
      '2026-11-30',
      '2026-12-01',
    ]);
  });
});

describe('dayKey', () => {
  it('reads the date in the zone, not in UTC', () => {
    expect(dayKey(now, zone)).toBe('2026-11-13');
    expect(dayKey(now, 'UTC')).toBe('2026-11-12');
  });
});

describe('bucketByDay', () => {
  it('adds readings to their day and drops the rest', () => {
    expect(
      bucketByDay(
        ['2026-11-12', '2026-11-13'],
        [
          { day: '2026-11-12', value: 2 },
          { day: '2026-11-13', value: 1 },
          { day: '2026-11-13', value: 3 },
          { day: '2026-10-01', value: 9 },
        ]
      )
    ).toEqual([2, 4]);
  });
});

describe('percentChange', () => {
  it('compares against the period before', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it('has nothing to say when the period before was empty', () => {
    expect(percentChange(5, 0)).toBeNull();
  });
});

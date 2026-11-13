import { describe, expect, it } from 'vitest';
import {
  monthKeys,
  monthName,
  monthShort,
  monthStartMs,
  toMonths,
  zoneOffsetMs,
} from './month-trend';

describe('zoneOffsetMs', () => {
  it('is zero in UTC and ahead in Perth', () => {
    const at = Date.UTC(2026, 10, 12, 12);
    expect(zoneOffsetMs(at, 'UTC')).toBe(0);
    expect(zoneOffsetMs(at, 'Australia/Perth')).toBe(8 * 3_600_000);
  });
});

describe('monthKeys', () => {
  it('ends with the current month and crosses the year', () => {
    const keys = monthKeys(Date.UTC(2026, 1, 10), 0, 4);
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('uses the zone, so late on the last day of a month is already the next', () => {
    const at = Date.UTC(2026, 9, 31, 20); // 4am on 1 Nov in Perth
    expect(monthKeys(at, 8 * 3_600_000, 1)).toEqual(['2026-11']);
    expect(monthKeys(at, 0, 1)).toEqual(['2026-10']);
  });
});

describe('monthStartMs', () => {
  it('is the zone midnight, not the UTC one', () => {
    expect(monthStartMs('2026-11', 8 * 3_600_000)).toBe(Date.UTC(2026, 9, 31, 16));
  });
});

describe('toMonths', () => {
  it('fills the gaps with zero', () => {
    expect(toMonths([{ month: '2026-02', n: 3 }], ['2026-01', '2026-02', '2026-03'])).toEqual([
      0, 3, 0,
    ]);
  });
});

describe('labels', () => {
  it('reads as a month', () => {
    expect(monthName('2026-11')).toBe('November 2026');
    expect(monthShort('2026-11')).toBe('Nov');
  });
});

import { describe, expect, it } from 'vitest';
import {
  bucketByDay,
  dayKey,
  monthGrid,
  monthKey,
  monthWindow,
  parseMonthKey,
  shiftMonth,
} from './calendar';

describe('month keys', () => {
  it('writes and reads a month, 0-based inside and 1-based outside', () => {
    expect(monthKey({ year: 2026, month: 10 })).toBe('2026-11');
    expect(parseMonthKey('2026-11')).toEqual({ year: 2026, month: 10 });
  });

  it('rejects anything that is not a month', () => {
    for (const bad of [
      '',
      '2026-13',
      '2026-00',
      '2026-1',
      '26-11',
      '2026-11-01',
      'abc',
      undefined,
    ]) {
      expect(parseMonthKey(bad)).toBeNull();
    }
    expect(parseMonthKey('1999-12')).toBeNull();
  });

  it('shifts across year ends, both ways', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe('monthGrid', () => {
  it('starts on a Monday and fills whole weeks', () => {
    // November 2026 starts on a Sunday, so its first week begins on Monday 26 October.
    const weeks = monthGrid({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(dayKey(weeks[0]![0]!)).toBe('2026-10-26');
    expect(weeks[0]![0]!.inMonth).toBe(false);
    expect(dayKey(weeks[0]![6]!)).toBe('2026-11-01');
    expect(weeks[0]![6]!.inMonth).toBe(true);
    expect(dayKey(weeks[5]![6]!)).toBe('2026-12-06');
  });

  it('is four weeks when a February starts on a Monday', () => {
    // February 2027 starts on a Monday and has 28 days.
    const weeks = monthGrid({ year: 2027, month: 1 });
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((d) => d.inMonth)).toBe(true);
  });

  it('is five weeks for an ordinary month', () => {
    // December 2026 starts on a Tuesday and has 31 days.
    expect(monthGrid({ year: 2026, month: 11 })).toHaveLength(5);
  });

  it('crosses a year end', () => {
    const weeks = monthGrid({ year: 2026, month: 11 });
    expect(dayKey(weeks.at(-1)!.at(-1)!)).toBe('2027-01-03');
  });
});

describe('monthWindow', () => {
  it('covers the whole grid with a day to spare either side', () => {
    const { from, to } = monthWindow({ year: 2026, month: 10 });
    expect(from).toBe(Date.UTC(2026, 9, 25));
    expect(to).toBe(Date.UTC(2026, 11, 8));
  });
});

describe('bucketByDay', () => {
  const MELBOURNE = 'Australia/Melbourne';

  it('places an item by its own zone, not the site’s', () => {
    // 11 pm on 14 November in Perth is 2 am on the 15th in Melbourne.
    const at = Date.UTC(2026, 10, 14, 15, 0);
    expect([...bucketByDay([{ at, timeZone: 'Australia/Perth' }], MELBOURNE).keys()]).toEqual([
      '2026-11-14',
    ]);
    expect([...bucketByDay([{ at }], MELBOURNE).keys()]).toEqual(['2026-11-15']);
  });

  it('lists a day soonest first', () => {
    const early = { at: Date.UTC(2026, 10, 14, 0, 0), id: 'early' };
    const late = { at: Date.UTC(2026, 10, 14, 6, 0), id: 'late' };
    const day = bucketByDay([late, early], 'UTC').get('2026-11-14');
    expect(day?.map((i) => i.id)).toEqual(['early', 'late']);
  });
});

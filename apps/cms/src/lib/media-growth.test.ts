import { describe, expect, it } from 'vitest';
import { addedIn, describeMonths, growthOf, monthsUntilFull } from './media-growth';

const keys = ['2026-11-10', '2026-11-11', '2026-11-12'];

describe('growthOf', () => {
  it('counts files and bytes on their days in the zone, and drops the rest', () => {
    const growth = growthOf(
      [
        { at: new Date('2026-11-11T05:00:00Z'), bytes: 100 },
        { at: new Date('2026-11-11T20:00:00Z'), bytes: 50 },
        { at: new Date('2026-10-01T00:00:00Z'), bytes: 999 },
        { at: null, bytes: 5 },
      ],
      keys,
      'UTC'
    );
    expect(growth.files).toEqual([0, 2, 0]);
    expect(growth.bytes).toEqual([0, 150, 0]);
  });

  it('puts an upload on the day it was in the site zone', () => {
    // 6pm UTC on the 11th is already the 12th in Perth.
    const growth = growthOf(
      [{ at: new Date('2026-11-11T18:00:00Z'), bytes: 7 }],
      keys,
      'Australia/Perth'
    );
    expect(growth.files).toEqual([0, 0, 1]);
  });
});

describe('addedIn', () => {
  it('adds up the latest days only', () => {
    const growth = { keys, files: [1, 2, 3], bytes: [10, 20, 30] };
    expect(addedIn(growth, 2)).toEqual({ files: 5, bytes: 50 });
  });
});

describe('monthsUntilFull', () => {
  it('goes by the pace of the span', () => {
    // 30 days adding 1 GB of a 10 GB allowance, 2 GB used: 8 GB left at about 1.01 GB a month.
    const months = monthsUntilFull(10, 2, 1, 30)!;
    expect(months).toBeCloseTo(7.9, 1);
  });

  it('has nothing to say when it did not grow', () => {
    expect(monthsUntilFull(10, 2, 0, 30)).toBeNull();
  });

  it('is zero once the allowance is used', () => {
    expect(monthsUntilFull(10, 12, 1, 30)).toBe(0);
  });
});

describe('describeMonths', () => {
  it('reads as a span of time', () => {
    expect(describeMonths(0.4)).toBe('less than a month');
    expect(describeMonths(1)).toBe('about 1 month');
    expect(describeMonths(14.4)).toBe('about 14 months');
    expect(describeMonths(40)).toBe('about 3 years');
    expect(describeMonths(2000)).toBe('many years');
  });
});

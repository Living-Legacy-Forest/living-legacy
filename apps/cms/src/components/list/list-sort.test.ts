import { describe, expect, it } from 'vitest';
import { byNumber, byText, sortedBy } from './list-sort';

describe('byText', () => {
  it('orders by the reader, not by character code', () => {
    const names = ['zoe', 'Álvaro', 'adam', 'Bea', 'item 10', 'item 2'];
    expect([...names].sort(byText)).toEqual(['adam', 'Álvaro', 'Bea', 'item 2', 'item 10', 'zoe']);
  });
  it('treats a missing value as empty, first', () => {
    expect(byText(null, 'a')).toBeLessThan(0);
    expect(byText(undefined, 'a')).toBeLessThan(0);
    expect(byText(null, undefined)).toBe(0);
    expect(['b', null, 'a'].sort(byText)).toEqual([null, 'a', 'b']);
  });
});

describe('byNumber', () => {
  it('orders by size and treats missing as zero', () => {
    expect(byNumber(undefined, 1)).toBeLessThan(0);
    expect(byNumber(null, undefined)).toBe(0);
    expect([3, null, 1, 2].sort(byNumber)).toEqual([null, 1, 2, 3]);
  });
});

describe('sortedBy', () => {
  const rows = [{ n: 'b' }, { n: 'a' }, { n: 'c' }];
  const comparators = { 'name-az': (x: { n: string }, y: { n: string }) => byText(x.n, y.n) };

  it("returns the page's own order, untouched, when the option has no comparator", () => {
    expect(sortedBy(rows, 'order', comparators)).toBe(rows);
  });
  it('sorts a copy and leaves the original alone', () => {
    const sorted = sortedBy(rows, 'name-az', comparators);
    expect(sorted.map((r) => r.n)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.n)).toEqual(['b', 'a', 'c']);
  });
});

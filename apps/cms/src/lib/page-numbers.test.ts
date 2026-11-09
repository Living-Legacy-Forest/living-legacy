import { describe, expect, it } from 'vitest';
import { pageNumbers } from './page-numbers';

describe('pageNumbers', () => {
  it('lists every page when there are few', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
  });

  it('keeps the first, last, current and its neighbours, with gaps between', () => {
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbers(10, 10)).toEqual([1, null, 9, 10]);
  });

  it('shows a lone skipped page rather than a gap', () => {
    expect(pageNumbers(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageNumbers(4, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

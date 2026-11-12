import { describe, expect, it } from 'vitest';
import { summariseTones } from './system-status';

describe('summariseTones', () => {
  it('is green with nothing to report', () => {
    expect(summariseTones([])).toEqual({ overall: 'green', red: 0, yellow: 0 });
    expect(summariseTones(['green', 'green'])).toEqual({ overall: 'green', red: 0, yellow: 0 });
  });

  it('takes the worst tone and counts the bad ones', () => {
    expect(summariseTones(['green', 'yellow', 'green'])).toEqual({
      overall: 'yellow',
      red: 0,
      yellow: 1,
    });
    expect(summariseTones(['red', 'yellow', 'yellow', 'green'])).toEqual({
      overall: 'red',
      red: 1,
      yellow: 2,
    });
  });
});

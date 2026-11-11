import { describe, expect, it } from 'vitest';
import { dayMonth, weekName, weekStart } from './shared';

// 11 Nov 2026, 2pm in Melbourne.
const NOW = Date.UTC(2026, 10, 11, 3, 0);
const ZONE = 'Australia/Melbourne';

describe('trend week names', () => {
  it('dates each week by the day it starts, ending with this week', () => {
    expect(weekName(11, 12, NOW, ZONE)).toBe('This week');
    expect(weekName(10, 12, NOW, ZONE)).toBe('Week of 28 Oct');
    expect(weekName(0, 12, NOW, ZONE)).toBe('Week of 19 Aug');
  });

  it('starts the axis on the first week', () => {
    expect(dayMonth(weekStart(0, 12, NOW), ZONE)).toBe('19 Aug');
  });

  it('counts back in weeks when there is no date to go by', () => {
    expect(weekName(11, 12, undefined, ZONE)).toBe('This week');
    expect(weekName(10, 12, undefined, ZONE)).toBe('Last week');
    expect(weekName(8, 12, undefined, ZONE)).toBe('3 weeks ago');
  });
});

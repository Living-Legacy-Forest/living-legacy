import { describe, expect, it } from 'vitest';
import { shouldHidePager } from './pager-visibility';

// The list area is 400px tall with the pager showing; the pager is 50px, so 450px without it.
const base = {
  scrollTop: 0,
  scrollHeight: 1000,
  clientHeight: 400,
  pagerHeight: 50,
  hidden: false,
};

describe('shouldHidePager', () => {
  it('hides at the top of a list that scrolls', () => {
    expect(shouldHidePager(base)).toBe(true);
  });

  it('shows once the list has been scrolled down', () => {
    expect(shouldHidePager({ ...base, scrollTop: 1 })).toBe(false);
  });

  it('stays shown when every row fits, so the other pages can still be reached', () => {
    expect(shouldHidePager({ ...base, scrollHeight: 400 })).toBe(false);
  });

  it('stays shown when hiding it would take away the scrolling', () => {
    // Taller than 400px, but not taller than the 450px the list would have without the pager.
    expect(shouldHidePager({ ...base, scrollHeight: 430 })).toBe(false);
    expect(shouldHidePager({ ...base, scrollHeight: 450 })).toBe(false);
    expect(shouldHidePager({ ...base, scrollHeight: 452 })).toBe(true);
  });

  it('stays hidden while the list, now taller by the pager, still scrolls', () => {
    const hidden = { ...base, hidden: true, clientHeight: 450 };
    expect(shouldHidePager({ ...hidden, scrollHeight: 460 })).toBe(true);
    expect(shouldHidePager({ ...hidden, scrollHeight: 450 })).toBe(false);
  });
});

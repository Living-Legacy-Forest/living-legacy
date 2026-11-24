import { describe, expect, it } from 'vitest';
import { countContentIssues, formatNavCount, sectionHasCount } from './nav-counts';

describe('formatNavCount', () => {
  it('shows the number, up to 99', () => {
    expect(formatNavCount(1)).toBe('1');
    expect(formatNavCount(99)).toBe('99');
  });

  it('caps it so the row keeps its width', () => {
    expect(formatNavCount(100)).toBe('99+');
    expect(formatNavCount(4812)).toBe('99+');
  });
});

describe('sectionHasCount', () => {
  const pages = [{ to: '/posts' }, { to: '/checks' }];

  it('is true when a page in it has something waiting', () => {
    expect(sectionHasCount(pages, { '/checks': 3 })).toBe(true);
  });

  it('is false for zero, for pages with no count, and for no counts yet', () => {
    expect(sectionHasCount(pages, { '/checks': 0 })).toBe(false);
    expect(sectionHasCount(pages, { '/redirects': 5 })).toBe(false);
    expect(sectionHasCount(pages, {})).toBe(false);
  });
});

describe('countContentIssues', () => {
  it('adds up every check', () => {
    const none = { total: 0 };
    expect(
      countContentIssues({
        noDescription: { total: 1 },
        noImage: { total: 2 },
        noAlt: { total: 3 },
        events: { total: 4 },
        duplicates: { total: 5 },
        redirected: { total: 6 },
        brand: { total: 7 },
        links: { total: 8 },
      })
    ).toBe(36);
    expect(
      countContentIssues({
        noDescription: none,
        noImage: none,
        noAlt: none,
        events: none,
        duplicates: none,
        redirected: none,
        brand: none,
        links: none,
      })
    ).toBe(0);
  });
});

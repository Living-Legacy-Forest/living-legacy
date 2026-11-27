import { describe, expect, it } from 'vitest';
import type { SidebarPage, SidebarSection } from './nav';
import {
  type NavPrefs,
  applyNavPrefs,
  emptyNavPrefs,
  hideKey,
  moveKey,
  movePinned,
  pagesScope,
  parseNavPrefs,
  resetNavOrder,
  sectionKey,
  showAllHidden,
  toggleCollapsed,
  togglePin,
} from './nav-prefs';

const icon = (() => null) as never;
const page = (to: string): SidebarPage => ({
  title: to.slice(1),
  to: to as SidebarPage['to'],
  icon,
});
const sections: SidebarSection[] = [
  { title: 'Content', icon, pages: [page('/posts'), page('/media'), page('/events')] },
  { title: 'Site', icon, pages: [page('/redirects'), page('/locations')] },
  { title: 'Admin', icon, pages: [page('/users')] },
];
const prefs = (over: Partial<NavPrefs>): NavPrefs => ({ ...emptyNavPrefs, ...over });
const titles = (s: SidebarSection[]) => s.map((x) => x.title);
const tos = (s: SidebarSection) => s.pages.map((p) => p.to);

describe('parseNavPrefs', () => {
  it('falls back to nothing customised for a missing or broken cookie', () => {
    expect(parseNavPrefs(undefined)).toEqual(emptyNavPrefs);
    expect(parseNavPrefs('{nope')).toEqual(emptyNavPrefs);
    expect(parseNavPrefs('[1,2]')).toEqual(emptyNavPrefs);
  });

  it('keeps what is well formed and drops what is not', () => {
    const raw = JSON.stringify({
      hidden: ['/media'],
      pinned: 'no',
      order: { sections: ['A'], x: 1 },
    });
    expect(parseNavPrefs(raw)).toEqual({
      collapsed: [],
      hidden: ['/media'],
      pinned: [],
      order: { sections: ['A'] },
    });
  });
});

describe('applyNavPrefs', () => {
  it('leaves the sidebar alone when nothing is set', () => {
    const shown = applyNavPrefs(sections, emptyNavPrefs, '/posts');
    expect(titles(shown.sections)).toEqual(['Content', 'Site', 'Admin']);
    expect(shown.customised).toBe(false);
  });

  it('reorders sections and pages, and puts unnamed items last', () => {
    const shown = applyNavPrefs(
      sections,
      prefs({
        order: { sections: ['Admin', 'Content'], [pagesScope('Content')]: ['/events', '/posts'] },
      }),
      '/posts'
    );
    expect(titles(shown.sections)).toEqual(['Admin', 'Content', 'Site']);
    expect(tos(shown.sections[1]!)).toEqual(['/events', '/posts', '/media']);
  });

  it('hides a page, and a section whose pages are all hidden', () => {
    const shown = applyNavPrefs(
      sections,
      prefs({ hidden: ['/media', '/users', sectionKey('Site')] }),
      '/posts'
    );
    expect(titles(shown.sections)).toEqual(['Content']);
    expect(tos(shown.sections[0]!)).toEqual(['/posts', '/events']);
    expect(shown.hiddenCount).toBe(3);
  });

  it('never hides the page you are on, or its section', () => {
    const shown = applyNavPrefs(
      sections,
      prefs({ hidden: ['/media', sectionKey('Content')] }),
      '/media'
    );
    expect(titles(shown.sections)).toContain('Content');
    // The page's section stays, and its other pages with it.
    expect(tos(shown.sections[0]!)).toEqual(['/posts', '/media', '/events']);
  });

  it('shows everything rather than an empty sidebar', () => {
    const everything = prefs({ hidden: sections.map((s) => sectionKey(s.title)) });
    expect(titles(applyNavPrefs(sections, everything, '/profile').sections)).toHaveLength(3);
  });

  it('lists pinned pages in order and drops ones this person cannot see', () => {
    const shown = applyNavPrefs(sections, prefs({ pinned: ['/users', '/gone', '/posts'] }), '/');
    expect(shown.pinned.map((p) => p.to)).toEqual(['/users', '/posts']);
  });
});

describe('changing prefs', () => {
  it('pins and unpins', () => {
    const pinned = togglePin(emptyNavPrefs, '/posts');
    expect(pinned.pinned).toEqual(['/posts']);
    expect(togglePin(pinned, '/posts').pinned).toEqual([]);
  });

  it('hides once and brings everything back', () => {
    const once = hideKey(hideKey(emptyNavPrefs, '/media'), '/media');
    expect(once.hidden).toEqual(['/media']);
    expect(showAllHidden(once).hidden).toEqual([]);
  });

  it('moves past the next shown item, jumping a hidden one', () => {
    const all = ['/posts', '/media', '/events'];
    const next = moveKey(emptyNavPrefs, 'p', all, ['/posts', '/events'], '/posts', 1);
    expect(next.order.p).toEqual(['/events', '/media', '/posts']);
  });

  it('does nothing at either end', () => {
    const all = ['/posts', '/media'];
    expect(moveKey(emptyNavPrefs, 'p', all, all, '/posts', -1)).toBe(emptyNavPrefs);
    expect(moveKey(emptyNavPrefs, 'p', all, all, '/media', 1)).toBe(emptyNavPrefs);
  });

  it('moves within the pinned list', () => {
    const start = prefs({ pinned: ['/a', '/b', '/c'] });
    expect(movePinned(start, '/c', -1).pinned).toEqual(['/a', '/c', '/b']);
    expect(movePinned(start, '/a', -1)).toBe(start);
  });

  it('folds a section shut and open again', () => {
    const shut = toggleCollapsed(emptyNavPrefs, 'Content');
    expect(shut.collapsed).toEqual(['Content']);
    expect(toggleCollapsed(shut, 'Content').collapsed).toEqual([]);
  });

  it('resets order and pins but keeps what is hidden', () => {
    const reset = resetNavOrder(prefs({ hidden: ['/media'], pinned: ['/a'], order: { x: ['y'] } }));
    expect(reset).toEqual({ hidden: ['/media'], pinned: [], order: {}, collapsed: [] });
  });
});

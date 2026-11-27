import type { SidebarPage, SidebarSection } from './nav';

// Each person's own take on the sidebar: pages pinned to the top, pages and sections hidden, and
// a different order. Held per browser (see nav-prefs-cookie.ts); the rules live here, free of the
// browser, so they can be tested.

export type NavPrefs = {
  /** Pages (by address) and sections (`section:Title`) taken out of the sidebar. */
  hidden: string[];
  /** Pages shown in a Pinned group above the section's pages, in this order. */
  pinned: string[];
  /** A custom order for a list, by scope: `sections`, or `pages:<Section>`. */
  order: Record<string, string[]>;
  /** Sections folded shut in the one-column sidebar, by title. */
  collapsed: string[];
};

export const emptyNavPrefs: NavPrefs = { hidden: [], pinned: [], order: {}, collapsed: [] };

export const SECTIONS_SCOPE = 'sections';
export const pagesScope = (sectionTitle: string) => `pages:${sectionTitle}`;
export const sectionKey = (sectionTitle: string) => `section:${sectionTitle}`;

const MAX_ENTRIES = 120;
const MAX_KEY = 80;

const isKeyList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= MAX_ENTRIES &&
  value.every((k) => typeof k === 'string' && k.length <= MAX_KEY);

/** Whatever is in the cookie, trusted for nothing: anything off the expected shape is dropped. */
export function parseNavPrefs(raw: string | undefined | null): NavPrefs {
  if (!raw) return emptyNavPrefs;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return emptyNavPrefs;
    const { hidden, pinned, order, collapsed } = data as Record<string, unknown>;
    const orders: Record<string, string[]> = {};
    if (typeof order === 'object' && order !== null) {
      for (const [scope, keys] of Object.entries(order).slice(0, 40)) {
        if (scope.length <= MAX_KEY && isKeyList(keys)) orders[scope] = keys;
      }
    }
    return {
      hidden: isKeyList(hidden) ? hidden : [],
      pinned: isKeyList(pinned) ? pinned : [],
      order: orders,
      collapsed: isKeyList(collapsed) ? collapsed : [],
    };
  } catch {
    return emptyNavPrefs;
  }
}

/** Items in the saved order; anything the order does not name keeps its place, after the rest. */
export function orderBy<T>(items: T[], key: (item: T) => string, order: string[] | undefined): T[] {
  if (!order?.length) return items;
  const rank = new Map(order.map((k, i) => [k, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.get(key(item)) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ item }) => item);
}

export type ShownSection = SidebarSection & {
  /** Every page of the section in order, hidden ones included: what a move shuffles. */
  orderedKeys: string[];
};

export type ShownNav = {
  sections: ShownSection[];
  /** Every section in order, hidden ones included. */
  sectionKeys: string[];
  pinned: SidebarPage[];
  /** How many hidden pages and sections there are to bring back. */
  hiddenCount: number;
  /** Anything pinned, hidden or reordered: what Reset applies to. */
  customised: boolean;
};

/**
 * The sidebar as this person has set it. What you are standing on is never hidden, so a page
 * opened from search or a link is still found in the sidebar; and if hiding would empty the
 * sidebar, nothing is hidden.
 */
export function applyNavPrefs(
  sections: SidebarSection[],
  prefs: NavPrefs,
  currentTo?: string
): ShownNav {
  const hidden = new Set(prefs.hidden);
  const ordered = orderBy(sections, (s) => s.title, prefs.order[SECTIONS_SCOPE]);
  const allPages = new Map<string, SidebarPage>(
    sections.flatMap((s) => s.pages).map((p) => [p.to, p])
  );

  const build = (respectHidden: boolean): ShownSection[] =>
    ordered.flatMap((section) => {
      const pages = orderBy(section.pages, (p) => p.to, prefs.order[pagesScope(section.title)]);
      const holdsCurrent = pages.some((p) => p.to === currentTo);
      if (respectHidden && !holdsCurrent && hidden.has(sectionKey(section.title))) return [];
      const shown = respectHidden
        ? pages.filter((p) => p.to === currentTo || !hidden.has(p.to))
        : pages;
      return shown.length
        ? [{ ...section, pages: shown, orderedKeys: pages.map((p) => p.to) }]
        : [];
    });

  const withHidden = build(true);
  const shown = withHidden.length ? withHidden : build(false);

  const known = new Set([...allPages.keys(), ...sections.map((s) => sectionKey(s.title))]);
  return {
    sections: shown,
    sectionKeys: ordered.map((s) => s.title),
    pinned: prefs.pinned.flatMap((to) => allPages.get(to) ?? []),
    hiddenCount: prefs.hidden.filter((k) => known.has(k)).length,
    customised:
      prefs.pinned.length > 0 || prefs.hidden.length > 0 || Object.keys(prefs.order).length > 0,
  };
}

export function togglePin(prefs: NavPrefs, to: string): NavPrefs {
  const pinned = prefs.pinned.includes(to)
    ? prefs.pinned.filter((k) => k !== to)
    : [...prefs.pinned, to];
  return { ...prefs, pinned };
}

export function toggleCollapsed(prefs: NavPrefs, title: string): NavPrefs {
  const collapsed = prefs.collapsed.includes(title)
    ? prefs.collapsed.filter((t) => t !== title)
    : [...prefs.collapsed, title];
  return { ...prefs, collapsed };
}

export function hideKey(prefs: NavPrefs, key: string): NavPrefs {
  return prefs.hidden.includes(key) ? prefs : { ...prefs, hidden: [...prefs.hidden, key] };
}

export function showKey(prefs: NavPrefs, key: string): NavPrefs {
  return { ...prefs, hidden: prefs.hidden.filter((k) => k !== key) };
}

export const showAllHidden = (prefs: NavPrefs): NavPrefs => ({ ...prefs, hidden: [] });

/** Back to the default order and nothing pinned; hidden items are brought back separately. */
export const resetNavOrder = (prefs: NavPrefs): NavPrefs => ({ ...prefs, order: {}, pinned: [] });

/**
 * Moves one step past the next item that is on show, so a hidden neighbour never makes a move
 * look like it did nothing. `all` is every key in order; `shown` the ones on screen.
 */
export function moveKey(
  prefs: NavPrefs,
  scope: string,
  all: string[],
  shown: string[],
  key: string,
  step: -1 | 1
): NavPrefs {
  const neighbour = shown[shown.indexOf(key) + step];
  if (neighbour === undefined || !all.includes(key)) return prefs;
  const next = [...all];
  const a = next.indexOf(key);
  const b = next.indexOf(neighbour);
  [next[a], next[b]] = [next[b]!, next[a]!];
  return { ...prefs, order: { ...prefs.order, [scope]: next } };
}

/** Pinned pages are their own order, so a move swaps within that list. */
export function movePinned(prefs: NavPrefs, to: string, step: -1 | 1): NavPrefs {
  const i = prefs.pinned.indexOf(to);
  const j = i + step;
  if (i < 0 || j < 0 || j >= prefs.pinned.length) return prefs;
  const next = [...prefs.pinned];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return { ...prefs, pinned: next };
}

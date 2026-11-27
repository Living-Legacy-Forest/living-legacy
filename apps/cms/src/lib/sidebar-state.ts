import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

// The sidebar's layout: whether each of its two columns shows names or only icons. Kept in a
// cookie so a reload comes back the way it was left. A cookie rather than local storage because
// the server renders the first paint and needs it too; otherwise the page would flash the
// default and then jump.

const LAYOUT_COOKIE = 'sidebar_layout';
const ONE_YEAR = 60 * 60 * 24 * 365;

export type SidebarState = {
  /** The rail of sections shows their names, not only icons. */
  railWide: boolean;
  /** The column of the section's pages shows their names, not only icons. */
  pagesWide: boolean;
  /**
   * One column of sections with their pages under them, or a rail of sections beside the pages.
   * Null: this person has not chosen, so the site's setting (Settings, Language & appearance) rules.
   */
  columns: 1 | 2 | null;
};

/** The layout as it is drawn, with the columns settled. */
export type ShownSidebarState = Omit<SidebarState, 'columns'> & { columns: 1 | 2 };

/** A first visit: section icons, with the pages named beside them. */
const DEFAULTS: SidebarState = { railWide: false, pagesWide: true, columns: null };

function cookieValue(header: string, name: string) {
  const prefix = `${name}=`;
  return header
    .split(/;\s*/)
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
}

/**
 * "10" is rail wide and pages narrow: one digit a column, so the cookie stays tiny. A third digit
 * is the person's own choice of columns: 1 one, 2 two, and 0 or none to follow the site.
 */
function parse(header: string): SidebarState {
  const raw = cookieValue(header, LAYOUT_COOKIE);
  if (!raw || !/^[01]{2}[012]?$/.test(raw)) return DEFAULTS;
  const columns = raw[2] === '1' ? 1 : raw[2] === '2' ? 2 : null;
  return { railWide: raw[0] === '1', pagesWide: raw[1] === '1', columns };
}

export const readSidebarState = createIsomorphicFn()
  .server(() => parse(getRequest().headers.get('cookie') ?? ''))
  .client(() => parse(document.cookie));

export function rememberSidebarState({ railWide, pagesWide, columns }: SidebarState) {
  const value = `${railWide ? 1 : 0}${pagesWide ? 1 : 0}${columns ?? 0}`;
  document.cookie = `${LAYOUT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

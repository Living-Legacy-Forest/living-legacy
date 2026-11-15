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
};

/** A first visit: section icons, with the pages named beside them. */
const DEFAULTS: SidebarState = { railWide: false, pagesWide: true };

function cookieValue(header: string, name: string) {
  const prefix = `${name}=`;
  return header
    .split(/;\s*/)
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
}

/** "10" is rail wide and pages narrow: one digit a column, so the cookie stays tiny. */
function parse(header: string): SidebarState {
  const raw = cookieValue(header, LAYOUT_COOKIE);
  if (!raw || !/^[01]{2}$/.test(raw)) return DEFAULTS;
  return { railWide: raw[0] === '1', pagesWide: raw[1] === '1' };
}

export const readSidebarState = createIsomorphicFn()
  .server(() => parse(getRequest().headers.get('cookie') ?? ''))
  .client(() => parse(document.cookie));

export function rememberSidebarState({ railWide, pagesWide }: SidebarState) {
  const value = `${railWide ? 1 : 0}${pagesWide ? 1 : 0}`;
  document.cookie = `${LAYOUT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

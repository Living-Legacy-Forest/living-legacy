import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

// Whether each list page shows rows or cards, kept in a cookie per page (`<page>_view`) so the
// server renders the first paint the way it was left, as the sidebar state does.

export type ListView = 'list' | 'grid';

const SUFFIX = '_view';
const ONE_YEAR = 60 * 60 * 24 * 365;

function parse(header: string): Record<string, ListView> {
  const views: Record<string, ListView> = {};
  for (const cookie of header.split(/;\s*/)) {
    const [name, value] = cookie.split('=');
    if (name?.endsWith(SUFFIX) && value === 'grid') views[name.slice(0, -SUFFIX.length)] = 'grid';
  }
  return views;
}

/** Pages left in grid view, by page name; any other page is a list. */
export const readListViews = createIsomorphicFn()
  .server(() => parse(getRequest().headers.get('cookie') ?? ''))
  .client(() => parse(document.cookie));

export function rememberListView(page: string, view: ListView) {
  document.cookie = `${page}${SUFFIX}=${view}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

const hasPaneClosed = (header: string, page: string) =>
  new RegExp(`(?:^|;\\s*)${page}_pane=closed`).test(header);

/** Whether a list page's side pane was left open (the default), read the same on server and client. */
export const readPaneOpen = createIsomorphicFn()
  .server((page: string) => !hasPaneClosed(getRequest().headers.get('cookie') ?? '', page))
  .client((page: string) => !hasPaneClosed(document.cookie, page));

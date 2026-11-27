import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { type NavPrefs, parseNavPrefs } from './nav-prefs';

// Kept in a cookie, as the sidebar's layout is (sidebar-state.ts): the server renders the first
// paint, and local storage would show the default sidebar and then rearrange it. Per browser,
// so a second computer starts from the default.

const COOKIE = 'nav_prefs';
const ONE_YEAR = 60 * 60 * 24 * 365;

function read(header: string): NavPrefs {
  const raw = header
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return parseNavPrefs(null);
  try {
    return parseNavPrefs(decodeURIComponent(raw));
  } catch {
    return parseNavPrefs(null);
  }
}

export const readNavPrefs = createIsomorphicFn()
  .server(() => read(getRequest().headers.get('cookie') ?? ''))
  .client(() => read(document.cookie));

export function rememberNavPrefs(prefs: NavPrefs) {
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

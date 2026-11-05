import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

// The sidebar's open state and which of its sections are expanded, kept in
// cookies so a reload comes back the way it was left. Cookies rather than
// local storage because the server renders the first paint and needs them too;
// otherwise the page would flash the default and then jump.

/** Written by components/ui/sidebar.tsx on every toggle. */
const OPEN_COOKIE = 'sidebar_state';
const SECTIONS_COOKIE = 'sidebar_sections';
const ONE_YEAR = 60 * 60 * 24 * 365;

export type SidebarState = {
  open: boolean;
  /** Section title to expanded, for sections someone has opened or closed. */
  sections: Record<string, boolean>;
};

function cookieValue(header: string, name: string) {
  const prefix = `${name}=`;
  return header
    .split(/;\s*/)
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
}

function parse(header: string): SidebarState {
  let sections: Record<string, boolean> = {};
  try {
    const raw = cookieValue(header, SECTIONS_COOKIE);
    const value: unknown = raw ? JSON.parse(decodeURIComponent(raw)) : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sections = Object.fromEntries(
        Object.entries(value).filter((e): e is [string, boolean] => typeof e[1] === 'boolean')
      );
    }
  } catch {
    // A mangled cookie just means starting from the defaults.
  }
  return { open: cookieValue(header, OPEN_COOKIE) !== 'false', sections };
}

export const readSidebarState = createIsomorphicFn()
  .server(() => parse(getRequest().headers.get('cookie') ?? ''))
  .client(() => parse(document.cookie));

export function rememberSection(title: string, expanded: boolean) {
  const { sections } = parse(document.cookie);
  sections[title] = expanded;
  document.cookie = `${SECTIONS_COOKIE}=${encodeURIComponent(JSON.stringify(sections))}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

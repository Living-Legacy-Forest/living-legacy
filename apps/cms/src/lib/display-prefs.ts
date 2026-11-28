import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

// How this person likes the interface to read and behave: text size, pointer cursors, underlined
// links and less motion. Kept in a cookie, like the sidebar layout, so the server draws the first
// paint the way it will stay; a stored value would flash the default and then jump.

const COOKIE = 'display_prefs';
const ONE_YEAR = 60 * 60 * 24 * 365;

export const TEXT_SIZES = ['small', 'default', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export type DisplayPrefs = {
  textSize: TextSize;
  /** Interactive things show a pointing hand, as on a web page. */
  pointerCursors: boolean;
  /** Links in text are always underlined, not only on hover. */
  underlineLinks: boolean;
  /** Animations and transitions are cut to nothing, whatever the device says. */
  reduceMotion: boolean;
};

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  textSize: 'default',
  pointerCursors: false,
  underlineLinks: false,
  reduceMotion: false,
};

/** "1010": the text size's place in TEXT_SIZES, then one digit each for the three switches. */
export function serialiseDisplayPrefs(prefs: DisplayPrefs) {
  const bit = (on: boolean) => (on ? 1 : 0);
  return `${TEXT_SIZES.indexOf(prefs.textSize)}${bit(prefs.pointerCursors)}${bit(prefs.underlineLinks)}${bit(prefs.reduceMotion)}`;
}

export function parseDisplayPrefs(header: string): DisplayPrefs {
  const raw = header
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw || !/^[012][01]{3}$/.test(raw)) return DEFAULT_DISPLAY_PREFS;
  return {
    textSize: TEXT_SIZES[Number(raw[0])] ?? 'default',
    pointerCursors: raw[1] === '1',
    underlineLinks: raw[2] === '1',
    reduceMotion: raw[3] === '1',
  };
}

export const readDisplayPrefs = createIsomorphicFn()
  .server(() => parseDisplayPrefs(getRequest().headers.get('cookie') ?? ''))
  .client(() => parseDisplayPrefs(document.cookie));

/** The attributes the stylesheet reads, on <html>. A switch that is off has no attribute. */
export function displayAttributes(prefs: DisplayPrefs) {
  return {
    'data-text-size': prefs.textSize === 'default' ? undefined : prefs.textSize,
    'data-pointer-cursors': prefs.pointerCursors ? '' : undefined,
    'data-underline-links': prefs.underlineLinks ? '' : undefined,
    'data-reduce-motion': prefs.reduceMotion ? '' : undefined,
  };
}

/** Saves the choice and puts it on the page now. */
export function applyDisplayPrefs(prefs: DisplayPrefs) {
  document.cookie = `${COOKIE}=${serialiseDisplayPrefs(prefs)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(displayAttributes(prefs))) {
    if (value === undefined) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

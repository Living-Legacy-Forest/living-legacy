import { useEffect } from 'react';
import type { Theme } from '@/server/settings';

function isDark(theme: Theme): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

// What the page should show once the transition's callback has run. A view transition applies
// the class a frame later, so reading the class back would be stale if a second change (a quick
// double press, or a failed save going back) arrives in that gap; the newest choice has to win.
let wanted = false;
let applying = false;

/**
 * One-shot resolve + apply, with no live OS-change listener. The page crossfades between the two
 * themes as one picture (see data-theme-change in styles.css), so text, surfaces and the logo
 * move together. Fading each element's own colour instead stalls inherited text, which waits on
 * its parent and then snaps at the end. People who ask for less motion get an instant change.
 */
export function setTheme(theme: Theme) {
  const root = document.documentElement;
  wanted = isDark(theme);
  // A change is already on its way and will read `wanted` when it runs.
  if (applying) return;
  if (root.classList.contains('dark') === wanted) return;
  const apply = () => void root.classList.toggle('dark', wanted);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof document.startViewTransition !== 'function') {
    apply();
    return;
  }

  root.dataset.themeChange = '';
  applying = true;
  const transition = document.startViewTransition(() => {
    applying = false;
    apply();
  });
  void transition.finished.finally(() => {
    delete root.dataset.themeChange;
    // A change that landed while the fade was playing, after the class was set.
    if (!applying && root.classList.contains('dark') !== wanted) apply();
  });
}

/** Resolves a Theme to <html>.dark and, for "system", tracks OS changes live. */
function applyTheme(theme: Theme): () => void {
  setTheme(theme);
  if (theme !== 'system') return () => {};

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => setTheme(theme);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

/**
 * Keeps <html>.dark in sync with the Theme setting on the client: resolves
 * "system" against the OS preference and tracks it live, and re-applies
 * whenever `theme` changes (e.g. right after Settings is saved, or while
 * previewing an unsaved choice on the Settings page).
 */
export function useThemeSync(theme: Theme) {
  useEffect(() => applyTheme(theme), [theme]);
}

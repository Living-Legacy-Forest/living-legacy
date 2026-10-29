import { useEffect } from 'react';
import type { Theme } from '@/server/settings';

function isDark(theme: Theme): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

/** One-shot resolve + apply, with no live OS-change listener. */
export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', isDark(theme));
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

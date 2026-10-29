import { useEffect } from 'react';
import type { Theme } from '@/server/settings';

/**
 * Keeps <html>.dark in sync with the Theme setting on the client: resolves
 * "system" against the OS preference and tracks it live, and re-applies
 * whenever `theme` changes (e.g. right after Settings is saved).
 */
export function useThemeSync(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;

    if (theme !== 'system') {
      root.classList.toggle('dark', theme === 'dark');
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

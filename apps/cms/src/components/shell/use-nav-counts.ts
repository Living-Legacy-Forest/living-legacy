import { useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavCounts } from '@/lib/nav-counts';
import { getNavCounts } from '@/server/nav-counts';

/** Moving between pages or tabs reloads the numbers at most this often. */
const REFRESH_MS = 60_000;

/**
 * The numbers beside sidebar pages, loaded after the page is up (like the bell and the system
 * status) and again, at most once a minute, when the tab regains focus or you move to another
 * page, so a fixed issue drops off without a reload. A failed load leaves the last answer: a
 * badge is a nudge, not a promise.
 */
export function useNavCounts(): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({});
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadedAt = useRef(0);

  const load = useCallback(() => {
    if (Date.now() - loadedAt.current < REFRESH_MS) return;
    loadedAt.current = Date.now();
    getNavCounts().then(setCounts, () => {
      // Try again next time rather than waiting out the minute.
      loadedAt.current = 0;
    });
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  return counts;
}

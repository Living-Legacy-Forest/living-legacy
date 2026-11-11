import { useEffect, useRef } from 'react';

/**
 * Calls `loadMore` when the returned element scrolls into view, for a list
 * that grows a page at a time. Starts loading a screen early so scrolling
 * rarely meets the end. Pair it with a visible "Show more" button for
 * keyboards and screen readers.
 */
export function useLoadMore<T extends Element>(loadMore: () => void, enabled: boolean) {
  const ref = useRef<T>(null);
  const latest = useRef(loadMore);
  latest.current = loadMore;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) latest.current();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

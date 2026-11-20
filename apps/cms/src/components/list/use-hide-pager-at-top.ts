import { type RefObject, useEffect, useRef, useState } from 'react';
import { shouldHidePager } from '@/lib/pager-visibility';

/**
 * Whether to tuck the pager away: true at the very top of the scrolling `rows`. `content` is the
 * pager's inner element, measured for its natural height (it is still measurable when collapsed).
 */
export function useHidePagerAtTop(
  rows: HTMLElement | null,
  content: RefObject<HTMLElement | null>
) {
  const [hidden, setHidden] = useState(false);
  const hiddenNow = useRef(false);

  useEffect(() => {
    if (!rows) return;
    const update = () => {
      const next = shouldHidePager({
        scrollTop: rows.scrollTop,
        scrollHeight: rows.scrollHeight,
        clientHeight: rows.clientHeight,
        pagerHeight: content.current?.scrollHeight ?? 0,
        hidden: hiddenNow.current,
      });
      if (next === hiddenNow.current) return;
      hiddenNow.current = next;
      setHidden(next);
    };
    update();
    rows.addEventListener('scroll', update, { passive: true });
    // The list's own size changes with the window and with the pager; its rows with a new page.
    const resize = new ResizeObserver(update);
    resize.observe(rows);
    const rowsChanged = new MutationObserver(update);
    rowsChanged.observe(rows, { childList: true, subtree: true });
    return () => {
      rows.removeEventListener('scroll', update);
      resize.disconnect();
      rowsChanged.disconnect();
    };
  }, [rows, content]);

  return hidden;
}

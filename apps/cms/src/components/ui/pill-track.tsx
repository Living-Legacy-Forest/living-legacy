import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A row of plain choices where the chosen one sits on a soft fill that glides to the next.
 * Shared by list filters (`SegmentedControl`), link rows such as the posts status tabs, and
 * `TabsList`, so they all look and move alike.
 */
export const pillTrackClass =
  'relative isolate inline-flex w-fit max-w-full min-w-0 items-center gap-0.5';

export const pillItemClass =
  'relative inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-ui whitespace-nowrap text-muted-foreground outline-none transition-colors duration-150 [-webkit-tap-highlight-color:transparent] pointer-fine:hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:font-medium aria-pressed:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground motion-reduce:transition-none';

/** The fill itself; `TabsList` draws it with Base UI's indicator instead. */
export const pillClass = 'rounded-md bg-muted';

/** The chosen item: a pressed toggle or the current page's link. Direct children only. */
const SELECTED = ':scope > [aria-pressed="true"], :scope > [aria-current="page"]';

/**
 * Render as the first child of a `pillTrackClass` row. It glides when `value` changes and moves
 * straight there on a resize or first placement. Until it has measured (the server render, the
 * first paint) the chosen item wears its own fill; see `[data-slot='pill-track']` in styles.css.
 */
export function PillGlide({
  value,
  selector = SELECTED,
  className,
}: {
  value: unknown;
  /** The chosen item, when it is not a pressed toggle or the current page (a menu radio, say). */
  selector?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const placed = React.useRef(false);

  const place = React.useCallback(
    (glide: boolean) => {
      const mark = ref.current;
      const track = mark?.parentElement;
      if (!mark || !track) return;
      const item = track.querySelector<HTMLElement>(selector);
      if (!item) {
        mark.style.opacity = '0';
        return;
      }
      mark.style.transition = glide ? '' : 'none';
      mark.style.translate = `${item.offsetLeft}px ${item.offsetTop}px`;
      mark.style.width = `${item.offsetWidth}px`;
      mark.style.height = `${item.offsetHeight}px`;
      mark.style.opacity = '1';
      track.dataset.glide = '';
    },
    [selector]
  );

  React.useLayoutEffect(() => {
    place(placed.current);
    placed.current = true;
  }, [value, place]);

  // Set up once: an observer reports a size as soon as it starts, and one made per change
  // would cut the glide short with it.
  React.useEffect(() => {
    const track = ref.current?.parentElement;
    if (!track || typeof ResizeObserver === 'undefined') return;
    let size = '';
    const observer = new ResizeObserver(() => {
      const next = `${track.scrollWidth}x${track.offsetHeight}`;
      if (size && next !== size) place(false);
      size = next;
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [place]);

  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="pill-glide"
      className={cn(
        pillClass,
        'pointer-events-none absolute top-0 left-0 -z-10 opacity-0',
        'transition-[translate,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        className
      )}
    />
  );
}

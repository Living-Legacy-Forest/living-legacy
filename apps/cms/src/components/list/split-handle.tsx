// The draggable divider between a list and its edit pane (lg and up). Drag it, use the arrow keys
// when it has focus (Shift for bigger steps, Home and End for the limits), or double-click to put it
// back. The width is remembered for each person, per page, in the browser.
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_SHARE,
  MIN_SHARE,
  parseStoredShare,
  shareFromPointer,
  stepShare,
} from '@/lib/split-share';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'll-list-split:';

/** The list's share of the width, kept in the browser under `key`. With no key it never changes. */
export function useSplit(key: string | undefined, fallback: number) {
  const [share, setShare] = useState(fallback);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(share);
  latest.current = share;

  // Read after the first paint, so the server and the browser agree on the first render.
  useEffect(() => {
    if (!key) return;
    try {
      setShare(parseStoredShare(localStorage.getItem(STORAGE_PREFIX + key), fallback));
    } catch {
      // Storage can be off (private windows): the width just is not remembered.
    }
  }, [key, fallback]);

  const commit = useCallback(() => {
    if (!key) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + key, String(latest.current));
    } catch {
      // As above.
    }
  }, [key]);

  const reset = useCallback(() => {
    setShare(fallback);
    if (!key) return;
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // As above.
    }
  }, [key, fallback]);

  return { share, setShare, dragging, setDragging, commit, reset };
}

export function SplitHandle({
  frame,
  share,
  onShare,
  onDragging,
  onCommit,
  onReset,
}: {
  /** The two-column frame, to measure where the pointer is across it. */
  frame: RefObject<HTMLElement | null>;
  share: number;
  onShare: (share: number) => void;
  onDragging: (dragging: boolean) => void;
  /** After a drag or key press, to remember the width. */
  onCommit: () => void;
  onReset: () => void;
}) {
  const [active, setActive] = useState(false);

  return (
    // A focusable separator is the ARIA "window splitter" pattern: it is a widget, which the lint
    // rule does not know, so its two complaints are switched off for this element only.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the list"
      aria-valuemin={Math.round(MIN_SHARE * 100)}
      aria-valuemax={Math.round(MAX_SHARE * 100)}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={`The list is ${Math.round(share * 100)}% of the width`}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      data-active={active || undefined}
      style={{ left: `${share * 100}%` }}
      className={cn(
        'touch:w-6 absolute inset-y-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none select-none lg:block',
        // The line shows on hover, on focus and while dragging; the 1px border beneath stays quiet.
        // It fades in after a short hover delay and thins out at both ends, so it reads as a soft edge.
        'after:bg-primary/50 after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:opacity-0 after:transition-opacity after:duration-150 after:ease-out',
        'after:[mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)]',
        'focus-visible:after:bg-primary data-active:after:bg-primary hover:after:opacity-100 hover:after:delay-100 focus-visible:after:opacity-100 data-active:after:opacity-100 data-active:after:delay-0 motion-reduce:after:transition-none'
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
        onDragging(true);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId) || !frame.current) return;
        onShare(shareFromPointer(event.clientX, frame.current.getBoundingClientRect()));
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setActive(false);
        onDragging(false);
        onCommit();
      }}
      onPointerCancel={() => {
        setActive(false);
        onDragging(false);
        onCommit();
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const big = event.shiftKey;
        if (event.key === 'ArrowLeft') onShare(stepShare(share, 'left', big));
        else if (event.key === 'ArrowRight') onShare(stepShare(share, 'right', big));
        else if (event.key === 'Home') onShare(MIN_SHARE);
        else if (event.key === 'End') onShare(MAX_SHARE);
        else return;
        event.preventDefault();
      }}
      onKeyUp={(event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) onCommit();
      }}
    />
  );
}

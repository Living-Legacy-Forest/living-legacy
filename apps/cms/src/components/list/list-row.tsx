import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRightIcon, Trash2Icon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { RowCheckbox } from './list-tools';

/** Width of the action a left swipe reveals. */
const ACTION_WIDTH = 84;
/** Movement before a touch counts as a swipe or a scroll, so taps stay taps. */
const SLOP = 10;
const SETTLE = 320;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * One row of a list page. The row's content goes in `children`, inside the
 * button that opens it.
 *
 * Touch screens: no hover, so the tick box and `actions` appear only in Edit
 * mode (`select.selecting`), rows are at least 44pt tall with a chevron, and
 * `swipe` adds an iOS-style left swipe that reveals a delete button.
 */
export function ListRow({
  current,
  select,
  actions,
  trailing,
  swipe,
  onOpen,
  onDoubleClick,
  buttonProps,
  align = 'center',
  children,
}: {
  /** The row open in the pane. */
  current: boolean;
  /** Tick box; leave out for people who cannot edit. */
  select?: { label: string; checked: boolean; selecting: boolean; onToggle: () => void };
  /** Buttons at the end of the row that belong to Edit mode on touch (e.g. reorder). */
  actions?: React.ReactNode;
  /** Something at the end of the row that always shows (e.g. a Publish button). */
  trailing?: React.ReactNode;
  swipe?: { label: string; onAction: () => void };
  onOpen: () => void;
  onDoubleClick?: () => void;
  /** Extra attributes for the row's main button (e.g. keyboard handling). */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, unknown>;
  align?: 'center' | 'start';
  children: React.ReactNode;
}) {
  const selecting = !!select?.selecting;
  const drag = useSwipe(!!swipe && !selecting);

  return (
    <li
      ref={drag.rowRef}
      className={cn(
        'group relative overflow-hidden rounded-md',
        current ? 'bg-accent' : 'hover:bg-muted/60'
      )}
    >
      {swipe && drag.revealed && (
        <button
          type="button"
          tabIndex={drag.open ? 0 : -1}
          aria-hidden={!drag.open}
          onClick={() => {
            drag.close();
            swipe.onAction();
          }}
          className="bg-destructive absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-white [&_svg]:size-5"
          style={{ width: ACTION_WIDTH }}
        >
          <Trash2Icon aria-hidden />
          {swipe.label}
        </button>
      )}
      <div
        ref={drag.surfaceRef}
        {...drag.handlers}
        className={cn(
          'touch:min-h-11 relative flex gap-1 rounded-md px-1.5 py-1',
          // Opaque only while it slides, so it covers the action behind it.
          drag.revealed && (current ? 'bg-accent' : 'bg-background'),
          align === 'start' ? 'items-start' : 'items-center',
          swipe && 'touch-pan-y'
        )}
      >
        {select && (
          <RowCheckbox
            label={select.label}
            checked={select.checked}
            selecting={select.selecting}
            onToggle={select.onToggle}
            className={align === 'start' ? 'mt-2' : undefined}
          />
        )}
        <button
          {...buttonProps}
          type="button"
          aria-current={current || undefined}
          onClick={onOpen}
          onDoubleClick={onDoubleClick}
          className="focus-visible:ring-ring touch:active:opacity-60 min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left outline-none focus-visible:ring-1"
        >
          {children}
        </button>
        {actions && (
          <div className={cn('flex shrink-0 items-center gap-0.5', !selecting && 'touch:hidden')}>
            {actions}
          </div>
        )}
        {trailing && <div className="flex shrink-0 items-center">{trailing}</div>}
        {!selecting && !trailing && (
          // The wrapper does the hiding: the animated icon sets its own display.
          <span
            aria-hidden
            className={cn(
              'text-muted-foreground/50 touch:flex hidden shrink-0',
              align === 'start' ? 'mt-2.5' : 'self-center'
            )}
          >
            <ChevronRightIcon className="size-4" />
          </span>
        )}
      </div>
    </li>
  );
}

type Gesture = {
  id: number;
  x: number;
  y: number;
  from: number;
  axis: 'x' | 'y' | null;
  samples: { x: number; t: number }[];
};

/**
 * Left swipe on touch: the row follows the finger 1:1, resists past its ends,
 * and on release settles open or closed from where the flick was heading.
 */
function useSwipe(enabled: boolean) {
  const rowRef = useRef<HTMLLIElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // The action behind the row exists only while the row is moved off it.
  const [revealed, setRevealed] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  // A drag ends with a click on whatever is under the finger; swallow it.
  const dragged = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const offset = () =>
    surfaceRef.current
      ? new DOMMatrixReadOnly(getComputedStyle(surfaceRef.current).transform).m41
      : 0;

  const moveTo = useCallback((x: number, animate: boolean) => {
    const el = surfaceRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = animate && !reduce ? `transform ${SETTLE}ms ${EASE_OUT}` : 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
    clearTimeout(hideTimer.current);
    if (x === 0) hideTimer.current = setTimeout(() => setRevealed(false), animate ? SETTLE : 0);
    else setRevealed(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    moveTo(0, true);
  }, [moveTo]);

  // An open row closes when the next touch lands anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, close]);

  // Leaving swipe-able (e.g. entering Edit mode) puts the row back.
  useEffect(() => {
    if (!enabled && open) close();
  }, [enabled, open, close]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || e.pointerType !== 'touch') return;
      dragged.current = false;
      // Start from where the row is on screen, so a row still settling can be caught.
      const from = offset();
      gesture.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        from,
        axis: null,
        samples: [],
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (g.axis === 'y') return;
        dragged.current = true;
        surfaceRef.current?.setPointerCapture(e.pointerId);
      }
      if (g.axis !== 'x') return;
      g.samples = [...g.samples.slice(-4), { x: e.clientX, t: e.timeStamp }];
      moveTo(resist(g.from + dx), false);
    },
    onPointerUp: () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.axis !== 'x') return;
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      const velocity =
        first && last && last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
      // Where the flick would come to rest, the way scrolling decelerates.
      const projected = offset() + (velocity / 1000) * (0.998 / (1 - 0.998));
      const next = projected < -ACTION_WIDTH / 2;
      setOpen(next);
      moveTo(next ? -ACTION_WIDTH : 0, true);
    },
    onPointerCancel: () => {
      if (!gesture.current) return;
      gesture.current = null;
      moveTo(open ? -ACTION_WIDTH : 0, true);
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!dragged.current && !open) return;
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
      if (open) close();
    },
  };

  return { rowRef, surfaceRef, open, revealed, close, handlers };
}

/** Follows the finger between closed and open; beyond either end it gives less and less. */
function resist(x: number) {
  const rubber = (over: number) =>
    (over * ACTION_WIDTH * 0.55) / (ACTION_WIDTH + 0.55 * Math.abs(over));
  if (x > 0) return rubber(x);
  if (x < -ACTION_WIDTH) return -ACTION_WIDTH + rubber(x + ACTION_WIDTH);
  return x;
}

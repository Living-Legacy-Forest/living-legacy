import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PanelRightIcon,
  PencilIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
} from '@/components/icons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { copyText } from '@/lib/site';
import { useSortLayout } from '@/lib/sort-motion';
import { cn } from '@/lib/utils';
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import { RowCheckbox } from './list-tools';

/** Width of the action a left swipe reveals. */
const ACTION_WIDTH = 84;
/** Movement before a touch counts as a swipe or a scroll, so taps stay taps. */
const SLOP = 10;
const SETTLE = 320;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/** An extra entry in a row's right-click (or long-press) menu. */
export type RowMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Goes to the red group at the bottom, with the swipe action. */
  destructive?: boolean;
  /** Works while the row has focus, and shows at the end of the item. */
  shortcut?: RowShortcut;
};

/** A plain key, or the Option key with it. Single keys, as in Gmail: they only act on the focused row. */
export type RowShortcut = { key: string; alt?: boolean };

const KEY_GLYPHS: Record<string, string> = {
  Enter: '↵',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
};

/** The shortcut as key caps at the end of a menu item. */
function ShortcutKeys({ shortcut: { key, alt } }: { shortcut: RowShortcut }) {
  return (
    <KbdGroup className="ml-auto">
      {alt && <Kbd>⌥</Kbd>}
      <Kbd>{KEY_GLYPHS[key] ?? key.toUpperCase()}</Kbd>
    </KbdGroup>
  );
}

function matchesShortcut(event: React.KeyboardEvent, { key, alt }: RowShortcut) {
  if (event.metaKey || event.ctrlKey || event.altKey !== !!alt) return false;
  // Mac keyboards label Backspace "delete"; full keyboards also have Delete.
  if (key === 'Backspace') return event.key === 'Backspace' || event.key === 'Delete';
  return event.key.toLowerCase() === key.toLowerCase();
}

/** Open, Select, the page's items, then the red group: the menu and the shortcuts share it. */
export function rowActions({
  onOpen,
  previews,
  onSelect,
  items,
  swipe,
}: {
  onOpen: () => void;
  previews?: boolean;
  onSelect?: () => void;
  items: RowMenuItem[];
  swipe?: { label: string; onAction: () => void };
}) {
  const actions: RowMenuItem[] = [
    {
      label: previews ? 'Preview' : 'Open',
      icon: previews ? <EyeIcon aria-hidden /> : <PanelRightIcon aria-hidden />,
      onSelect: onOpen,
      shortcut: { key: 'Enter' },
    },
    ...(onSelect
      ? [
          {
            label: 'Select',
            icon: <CircleCheckIcon aria-hidden />,
            onSelect,
            shortcut: { key: 'x' },
          },
        ]
      : []),
    ...items.filter((item) => !item.destructive),
  ];
  const destructive: RowMenuItem[] = [
    ...items.filter((item) => item.destructive),
    ...(swipe
      ? [
          {
            label: swipe.label,
            icon: <Trash2Icon aria-hidden />,
            onSelect: swipe.onAction,
            shortcut: { key: 'Backspace' },
          },
        ]
      : []),
  ];
  return { actions, destructive };
}

/** Publish, or Unpublish (with the red actions), for content with a draft/published switch. */
export function publishMenuItem(
  published: boolean,
  setStatus: (status: 'draft' | 'published') => void
): RowMenuItem {
  return published
    ? {
        label: 'Unpublish',
        icon: <EyeOffIcon aria-hidden />,
        onSelect: () => setStatus('draft'),
        destructive: true,
        shortcut: { key: 'u' },
      }
    : {
        label: 'Publish',
        icon: <SendIcon aria-hidden />,
        onSelect: () => setStatus('published'),
        shortcut: { key: 'p' },
      };
}

/** Feature, or take off the featured spot. */
export function featureMenuItem(
  featured: boolean,
  setFeatured: (next: boolean) => void
): RowMenuItem {
  return {
    label: featured ? 'Remove from featured' : 'Feature',
    icon: <StarIcon aria-hidden />,
    onSelect: () => setFeatured(!featured),
    shortcut: { key: 'f' },
  };
}

/** Copy some of the row's text, such as its question or address. */
export function copyMenuItem(what: string, text: string, key = 'c'): RowMenuItem {
  return {
    label: `Copy ${what.toLowerCase()}`,
    icon: <CopyIcon aria-hidden />,
    onSelect: () => void copyText(text, what),
    shortcut: { key },
  };
}

/** Edit, for rows whose click shows a preview. Where a click already edits, leave it out. */
export function editMenuItems(show: boolean, onEdit: () => void): RowMenuItem[] {
  return show
    ? [
        {
          label: 'Edit',
          icon: <PencilIcon aria-hidden />,
          onSelect: onEdit,
          shortcut: { key: 'e' },
        },
      ]
    : [];
}

/** Move up and Move down for a hand-sorted list, leaving out a move that can't happen. */
export function moveMenuItems(
  canMoveUp: boolean,
  canMoveDown: boolean,
  move: (direction: 'up' | 'down') => void
): RowMenuItem[] {
  return [
    ...(canMoveUp
      ? [
          {
            label: 'Move up',
            icon: <ArrowUpIcon aria-hidden />,
            onSelect: () => move('up'),
            shortcut: { key: 'ArrowUp', alt: true },
          },
        ]
      : []),
    ...(canMoveDown
      ? [
          {
            label: 'Move down',
            icon: <ArrowDownIcon aria-hidden />,
            onSelect: () => move('down'),
            shortcut: { key: 'ArrowDown', alt: true },
          },
        ]
      : []),
  ];
}

/**
 * One row of a list page. The row's content goes in `children`, inside the
 * button that opens it.
 *
 * Touch screens: no hover, so the tick box and `actions` appear only in Edit
 * mode (`select.selecting`), rows are at least 44pt tall with a chevron, and
 * `swipe` adds an iOS-style left swipe that reveals a delete button.
 *
 * Right-click, or a long press on touch, opens a menu: Open, Select (with a
 * tick box), any `menu` items, then destructive ones and the swipe action. It is a shortcut only, so everything in it
 * must also be reachable another way.
 */
export function ListRow({
  current,
  select,
  actions,
  trailing,
  swipe,
  menu,
  previews,
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
  /** Extra actions for the row's context menu, between Open and the swipe action. */
  menu?: RowMenuItem[];
  /** A click shows a preview here rather than the edit form, so the menu says Preview. */
  previews?: boolean;
  onOpen: () => void;
  onDoubleClick?: () => void;
  /** Extra attributes for the row's main button (e.g. keyboard handling). */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, unknown>;
  align?: 'center' | 'start';
  children: React.ReactNode;
}) {
  const selecting = !!select?.selecting;
  const sortLayout = useSortLayout();
  const drag = useSwipe(!!swipe && !selecting);
  const hasMenu = !selecting && !!(menu?.length || swipe || select);
  const { actions: menuActions, destructive } = rowActions({
    onOpen,
    previews,
    onSelect: select?.onToggle,
    items: menu ?? [],
    swipe,
  });

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    buttonProps?.onKeyDown?.(event);
    if (!hasMenu || event.defaultPrevented) return;
    // Enter already opens the focused row; ignore it here so it doesn't run twice.
    if (event.key === 'Enter') return;
    const action = [...menuActions, ...destructive].find(
      (item) => item.shortcut && !item.disabled && matchesShortcut(event, item.shortcut)
    );
    if (!action) return;
    event.preventDefault();
    action.onSelect();
  };

  const surface = (
    <div
      ref={drag.surfaceRef}
      {...drag.handlers}
      className={cn(
        'touch:min-h-11 relative flex gap-1 rounded-md px-1.5 py-1',
        'max-md:min-h-11 max-md:rounded-none max-md:py-0 max-md:pr-3 max-md:pl-2.5',
        // Opaque only while it slides, so it covers the action behind it.
        drag.revealed && (current ? 'bg-accent' : 'bg-background max-md:bg-(--ios-cell)'),
        align === 'start' ? 'items-start' : 'items-center',
        swipe && 'touch-pan-y',
        // While its context menu is open, so it is clear which row the menu acts on.
        !current &&
          'group-data-popup-open/row-menu:bg-muted max-md:group-data-popup-open/row-menu:bg-(--ios-fill)'
      )}
    >
      {select && (
        <RowCheckbox
          label={select.label}
          checked={select.checked}
          selecting={select.selecting}
          onToggle={select.onToggle}
          className={align === 'start' ? 'mt-2 max-md:mt-0 max-md:self-center' : undefined}
        />
      )}
      <button
        {...buttonProps}
        type="button"
        data-row-main=""
        aria-current={current || undefined}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          // Safari leaves a clicked button unfocused; the row's shortcuts need focus.
          event.currentTarget.focus({ preventScroll: true });
          onOpen();
        }}
        onDoubleClick={onDoubleClick}
        className={cn(
          'focus-visible:ring-ring touch:active:opacity-60 min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left outline-none focus-visible:ring-1 max-md:py-2.5 max-md:active:opacity-100',
          // Held for a long press, it sinks a little, so the press shows before the menu does.
          hasMenu &&
            'touch:transition-[scale] touch:duration-150 touch:active:scale-[0.97] touch:active:delay-150 touch:active:duration-350 motion-reduce:transition-none'
        )}
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
            'text-muted-foreground/50 touch:flex hidden shrink-0 max-md:text-(--ios-secondary) max-md:opacity-60',
            // Phones centre it in the cell, as iOS does, however many lines the row has.
            align === 'start' ? 'mt-2.5 max-md:mt-0 max-md:self-center' : 'self-center'
          )}
        >
          <ChevronRightIcon className="size-4" />
        </span>
      )}
    </div>
  );

  return (
    <motion.li
      {...sortLayout}
      ref={drag.rowRef}
      data-slot="list-row"
      className={cn(
        // Hover is the list's gliding highlight (ListRows), which this row sits above.
        'group relative overflow-hidden rounded-md',
        current && 'bg-accent',
        // Phones: a cell in the grouped list. It highlights while pressed, not on hover.
        'max-md:rounded-none max-md:bg-transparent max-md:hover:bg-transparent max-md:has-[[data-row-main]:active]:bg-(--ios-fill)'
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
      {hasMenu ? (
        <RowMenu
          actions={menuActions}
          destructive={destructive}
          anchorRef={drag.surfaceRef}
          preview={children}
        >
          {surface}
        </RowMenu>
      ) : (
        surface
      )}
    </motion.li>
  );
}

/**
 * Right-click opens a small menu at the pointer. A 500ms long press on touch
 * opens it the iOS way instead: the page blurs, the row lifts out as a card
 * where it was, and the actions sit under it (over it, near the bottom of the
 * screen). The press gives up once the finger moves 10px, the same distance
 * that starts a swipe, so the two never both happen.
 */
export function RowMenu({
  actions,
  destructive,
  anchorRef,
  preview,
  previewClassName = 'px-4 py-2.5',
  children,
}: {
  actions: RowMenuItem[];
  destructive: RowMenuItem[];
  anchorRef: React.RefObject<HTMLDivElement | null>;
  preview: React.ReactNode;
  /** Padding for the lifted card on touch; an image tile fills it instead. */
  previewClassName?: string;
  children: React.ReactNode;
}) {
  const [touch, setTouch] = useState(false);
  // Lifting the finger after a long press can land as a tap on the row; don't open it.
  const openedAt = useRef(0);

  return (
    <ContextMenu
      onOpenChange={(open, details) => {
        if (!open) return;
        openedAt.current = Date.now();
        const viaTouch = details.event?.type.startsWith('touch') ?? false;
        setTouch(viaTouch);
        if (viaTouch) navigator.vibrate?.(10);
      }}
    >
      <ContextMenuTrigger
        className="group/row-menu contents"
        onClickCapture={(e) => {
          if (Date.now() - openedAt.current > 800) return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </ContextMenuTrigger>
      {touch ? (
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/15 backdrop-blur-md transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none dark:bg-black/40" />
          <ContextMenuPrimitive.Positioner
            className="z-50 outline-none"
            anchor={anchorRef}
            side="bottom"
            align="start"
            // Starts level with the row, so the card covers it exactly.
            sideOffset={({ anchor }) => -anchor.height}
            collisionPadding={12}
          >
            <ContextMenuPrimitive.Popup className="flex w-(--anchor-width) origin-(--transform-origin) flex-col gap-2 transition-[opacity,scale] duration-200 ease-out outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 data-[side=top]:flex-col-reverse motion-reduce:transition-none">
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none flex min-h-(--anchor-height) flex-col justify-center overflow-hidden rounded-xl bg-(--ios-cell) shadow-lg',
                  previewClassName
                )}
              >
                {preview}
              </div>
              <div className="w-72 max-w-full overflow-hidden rounded-[13px] bg-(--ios-cell-raised)/90 shadow-xl backdrop-blur-xl">
                <div className="divide-y divide-(--ios-separator)">
                  {actions.map((item) => (
                    <TouchMenuItem key={item.label} item={item} />
                  ))}
                </div>
                {destructive.length > 0 && (
                  <div className="divide-y divide-(--ios-separator) border-t-8 border-(--ios-fill)">
                    {destructive.map((item) => (
                      <TouchMenuItem key={item.label} item={item} destructive />
                    ))}
                  </div>
                )}
              </div>
            </ContextMenuPrimitive.Popup>
          </ContextMenuPrimitive.Positioner>
        </ContextMenuPrimitive.Portal>
      ) : (
        <ContextMenuContent className="min-w-56 p-1.5">
          {actions.map((item) => (
            <ContextMenuItem
              key={item.label}
              className={DESKTOP_ITEM}
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {item.icon}
              {item.label}
              {item.shortcut && <ShortcutKeys shortcut={item.shortcut} />}
            </ContextMenuItem>
          ))}
          {destructive.length > 0 && <ContextMenuSeparator />}
          {destructive.map((item) => (
            <ContextMenuItem
              key={item.label}
              className={DESKTOP_ITEM}
              variant="destructive"
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {item.icon}
              {item.label}
              {item.shortcut && <ShortcutKeys shortcut={item.shortcut} />}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}

/** Roomier rows with smaller type than the default menu, so a long menu stays easy to scan. */
const DESKTOP_ITEM = "text-ui gap-2 py-1.5 [&_svg:not([class*='size-'])]:size-3.5";

/** A UIKit menu row: body-sized label, icon at the trailing edge. */
function TouchMenuItem({ item, destructive }: { item: RowMenuItem; destructive?: boolean }) {
  return (
    <ContextMenuPrimitive.Item
      disabled={item.disabled}
      onClick={item.onSelect}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 px-4 text-[0.9375rem] outline-none select-none active:bg-(--ios-fill) data-disabled:opacity-40 [&_svg]:size-4',
        destructive && 'text-destructive'
      )}
    >
      {item.label}
      {item.icon}
    </ContextMenuPrimitive.Item>
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

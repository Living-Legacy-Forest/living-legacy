import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
  type Variants,
} from 'motion/react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A range picker whose trigger grows into the panel it opens, ported from a shadcn-registry
// motion library onto our tokens and Button. Two months sit side by side when the surrounding
// pane is wide enough, one otherwise. The range band stretches across each week as you hover or
// move with the keyboard, the two ends glide between days, months slide the way you travel, and
// on Apply the label flies back into the trigger as the surface shrinks around it.

/** An inclusive range of whole days. */
export type DateRange = { start: Date; end: Date };

/** A shortcut in the preset rail. `range` gets the viewer's local today. */
export type DateRangePreset = { label: string; range: (today: Date) => DateRange };

type DateRangePickerProps = {
  /** Controlled value. `null` for no selection. */
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  /** Called with the applied range. */
  onChange?: (range: DateRange) => void;
  /** Id of the trigger, so a `<Label htmlFor>` can point at it. */
  id?: string;
  /** Accessible name of the trigger and the panel. */
  label?: string;
  placeholder?: string;
  /** Shown as a rail beside the months; none by default. */
  presets?: DateRangePreset[];
  minDate?: Date;
  maxDate?: Date;
  /** 0 is Sunday, 1 is Monday. */
  weekStartsOn?: 0 | 1;
  /** Force one or two months. `auto` picks two when the pane around it is wide enough. */
  months?: 'auto' | 1 | 2;
  /** The element the panel stays inside. Defaults to the nearest scrolling ancestor. */
  boundary?: () => HTMLElement | null;
  className?: string;
};

type Size = { w: number; h: number };
type Bezier = [number, number, number, number];

const DAY = 864e5;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);
const shiftMonths = (date: Date, amount: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    Math.min(
      date.getDate(),
      new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate()
    )
  );
const dayDiff = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY);
const monthDiff = (a: Date, b: Date) =>
  (a.getFullYear() - b.getFullYear()) * 12 + a.getMonth() - b.getMonth();
const sameDay = (a?: Date | null, b?: Date | null) => Boolean(a && b && dayDiff(a, b) === 0);
const keyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = (key: string) => {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const ordered = (a: Date, b: Date): DateRange =>
  dayDiff(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
const sameRange = (a?: DateRange | null, b?: DateRange | null) =>
  Boolean(a && b && sameDay(a.start, b.start) && sameDay(a.end, b.end));
const clampDate = (date: Date, min?: Date, max?: Date) =>
  min && dayDiff(date, min) < 0
    ? startOfDay(min)
    : max && dayDiff(date, max) > 0
      ? startOfDay(max)
      : date;

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('en-AU', options);
const FULL = { day: 'numeric', month: 'short', year: 'numeric' } as const;
/** "14 Nov 2026", "14 to 15 Nov 2026", "30 Nov to 2 Dec 2026". Words, never a dash. */
function rangeLabel(range: DateRange) {
  const { start, end } = range;
  if (sameDay(start, end)) return fmt(start, FULL);
  const from =
    start.getFullYear() !== end.getFullYear()
      ? fmt(start, FULL)
      : start.getMonth() !== end.getMonth()
        ? fmt(start, { day: 'numeric', month: 'short' })
        : fmt(start, { day: 'numeric' });
  return `${from} to ${fmt(end, FULL)}`;
}

const dateKey = (date: Date) => keyOf(date);
/** Today turns over at local midnight; coming back to the tab reads it again. */
const subscribeToday = (notify: () => void) => {
  let timer = 0;
  const schedule = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = window.setTimeout(
      () => {
        notify();
        schedule();
      },
      midnight.getTime() - now.getTime() + 1000
    );
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') notify();
  };
  schedule();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', notify);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', notify);
  };
};
/** The viewer's local date; undefined until hydrated, so markup never depends on the server clock. */
function useToday() {
  const key = useSyncExternalStore(
    subscribeToday,
    () => dateKey(new Date()),
    () => ''
  );
  return useMemo(() => (key ? fromKey(key) : undefined), [key]);
}

const noop = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
  return !!useReducedMotion() && hydrated;
}

/** The nearest scrolling ancestor (a pane or dialog body): the panel has to fit inside it. A
 * group that only clips for its rounded corners lets the open panel spill over (styles.css). */
function clippingParent(node: HTMLElement | null) {
  for (let el = node?.parentElement; el && el !== document.body; el = el.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(el).overflowX)) return el;
  }
  return null;
}

const duration = { instant: 0.1, fast: 0.15, exit: 0.14, standard: 0.2 };
const enterEase: Bezier = [0.16, 1, 0.3, 1];
const standardEase: Bezier = [0.22, 1, 0.36, 1];
const blur = { subtle: 2, soft: 4 };
/** Duration springs as stiffness and damping, so a retarget keeps the velocity already in flight. */
const physical = (visualDuration: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2);
  return { type: 'spring', stiffness: root * root, damping: 2 * root, mass: 1 };
};
const GROW = physical(0.3);
const SHRINK = physical(0.2);
const STRETCH = physical(0.3);
const GLIDE = physical(0.3);
const SLIDE = physical(0.3);
const PANEL_RADIUS = 12;
const WIDE_CELL = 36;
const EDGE = 8;

const roll: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: `${direction * 0.45}em`,
    filter: `blur(${blur.subtle}px)`,
  }),
  center: {
    opacity: 1,
    y: '0em',
    filter: 'blur(0px)',
    transition: { duration: duration.standard, ease: enterEase },
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${direction * -0.45}em`,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: duration.fast, ease: standardEase },
  }),
};
const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: '0em', filter: 'blur(0px)', transition: { duration: duration.instant } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};
/** Panel content arrives just behind the growing surface and leaves ahead of it. */
const faceIn: Variants = {
  hidden: { opacity: 0, y: -4, filter: `blur(${blur.soft}px)` },
  shown: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: duration.standard, ease: enterEase, delay: 0.08 },
  },
  gone: {
    opacity: 0,
    y: -2,
    filter: `blur(${blur.soft}px)`,
    transition: { duration: duration.instant, ease: standardEase },
  },
};
const faceFade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.instant } },
  gone: { opacity: 0, transition: { duration: 0.08 } },
};
const slide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 48 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { x: SLIDE, opacity: { duration: duration.standard, ease: enterEase } },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -36,
    transition: { x: SLIDE, opacity: { duration: duration.fast, ease: standardEase } },
  }),
};

/** Words roll one by one: a later date rises, an earlier one drops; unchanged words hold still. */
function Rolling({
  text,
  direction,
  reduced,
}: {
  text: string;
  direction: number;
  reduced: boolean;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span aria-hidden className="inline-flex gap-[0.28em] whitespace-nowrap">
      {words.map((word, index) => (
        <span key={index} className="relative inline-block">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.span
              key={word}
              className="inline-block"
              custom={direction}
              variants={reduced ? fade : roll}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** Which way a range moved, so labels roll in time's direction. */
function useDirection(range: DateRange | null) {
  const time = range ? range.start.getTime() * 2 + range.end.getTime() : null;
  const [previous, setPrevious] = useState(time);
  const [direction, setDirection] = useState(1);
  if (time !== previous) {
    setPrevious(time);
    setDirection(time === null || previous === null || time >= previous ? 1 : -1);
  }
  return direction;
}

type Segment = { left: number; width: number } | null;
const cellIn = (date: Date, first: Date) => {
  const index = dayDiff(date, first);
  return { row: Math.floor(index / 7), col: index % 7 };
};

/** One week's slice of the band. It grows out of the edge the range arrives from, so hovering reads as stretching. */
function Bar({ row, segment, reduced }: { row: number; segment: Segment; reduced: boolean }) {
  const left = useMotionValue(segment?.left ?? 0);
  const width = useMotionValue(segment?.width ?? 0);
  const opacity = useMotionValue(segment ? 1 : 0);
  const leftPct = useTransform(left, (value) => `${value}%`);
  const widthPct = useTransform(width, (value) => `${value}%`);
  const wasEmpty = useRef(!segment);
  useLayoutEffect(() => {
    if (!segment) {
      wasEmpty.current = true;
      animate(opacity, 0, { duration: reduced ? 0 : duration.exit });
      return;
    }
    if (wasEmpty.current || reduced) {
      left.jump(segment.left);
      width.jump(segment.width);
    } else {
      animate(left, segment.left, STRETCH);
      animate(width, segment.width, STRETCH);
    }
    wasEmpty.current = false;
    animate(opacity, 1, { duration: reduced ? 0 : duration.fast });
  }, [left, opacity, reduced, segment, width]);
  return (
    <motion.span
      className="bg-primary/15 absolute h-[calc(var(--cell)-6px)] rounded-full"
      style={{ left: leftPct, width: widthPct, opacity, top: `calc(${row} * var(--cell) + 3px)` }}
    />
  );
}

/** A solid end of the range. It glides from day to day and only fades when the end leaves this month. */
function Thumb({ cell, reduced }: { cell: { row: number; col: number } | null; reduced: boolean }) {
  const x = useMotionValue(cell?.col ?? 0);
  const y = useMotionValue(cell?.row ?? 0);
  const opacity = useMotionValue(cell ? 1 : 0);
  const scale = useMotionValue(cell ? 1 : 0.8);
  const transform = useTransform(
    () => `translate(${x.get() * 100}%, ${y.get() * 100}%) scale(${scale.get()})`
  );
  const hidden = useRef(!cell);
  useLayoutEffect(() => {
    if (!cell) {
      hidden.current = true;
      animate(opacity, 0, { duration: reduced ? 0 : duration.instant });
      animate(scale, 0.8, { duration: reduced ? 0 : duration.instant });
      return;
    }
    if (hidden.current || reduced) {
      x.jump(cell.col);
      y.jump(cell.row);
    } else {
      animate(x, cell.col, GLIDE);
      animate(y, cell.row, GLIDE);
    }
    hidden.current = false;
    animate(opacity, 1, { duration: reduced ? 0 : duration.fast });
    animate(scale, 1, reduced ? { duration: 0 } : GLIDE);
  }, [cell, opacity, reduced, scale, x, y]);
  return (
    <motion.span
      className="before:bg-primary absolute top-0 left-0 size-(--cell) before:absolute before:inset-[3px] before:rounded-full"
      style={{ transform, opacity }}
    />
  );
}

type Formatters = {
  title: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  weekday: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
};

type MonthProps = {
  month: Date;
  range: DateRange | null;
  tabbable: string;
  today?: Date;
  minDate?: Date;
  maxDate?: Date;
  weekStartsOn: 0 | 1;
  reduced: boolean;
  /** The last move came from the keyboard, so the band lands at once instead of gliding. */
  instant?: boolean;
  formatters: Formatters;
  onPick: (date: Date) => void;
  onHover: (date: Date) => void;
  onKey: (event: ReactKeyboardEvent<HTMLButtonElement>, date: Date) => void;
  onFocusDay: (date: Date) => void;
  idBase: string;
};

function Month({
  month,
  range,
  tabbable,
  today,
  minDate,
  maxDate,
  weekStartsOn,
  reduced,
  instant = false,
  formatters,
  onPick,
  onHover,
  onKey,
  onFocusDay,
  idBase,
}: MonthProps) {
  const first = useMemo(
    () => addDays(month, -((month.getDay() - weekStartsOn + 7) % 7)),
    [month, weekStartsOn]
  );
  const rows = useMemo(
    () =>
      Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 7 }, (_, col) => addDays(first, row * 7 + col))
      ),
    [first]
  );
  const titleId = `${idBase}-${keyOf(month)}`;

  const lo = range?.start;
  const hi = range?.end;
  const loKey = lo ? keyOf(lo) : '';
  const hiKey = hi ? keyOf(hi) : '';
  /** Each week's slice of the range, in percent of the row. Keyed by the range's days so bars only move when it does. */
  const segments = useMemo<Segment[]>(() => {
    // A one-day range is just its end disc; a band there would show as a halo around it.
    if (!loKey || !hiKey || loKey === hiKey) return rows.map(() => null);
    const start = fromKey(loKey);
    const end = fromKey(hiKey);
    const unit = 100 / 7;
    const colOf = (date: Date) => dayDiff(date, first) % 7;
    return rows.map((row) => {
      const days = row.filter((date) => monthDiff(date, month) === 0);
      const rowFirst = days[0];
      const rowLast = days[days.length - 1];
      if (!rowFirst || !rowLast) return null;
      const from = dayDiff(start, rowFirst) > 0 ? start : rowFirst;
      const to = dayDiff(end, rowLast) < 0 ? end : rowLast;
      if (dayDiff(from, to) <= 0) {
        const a = colOf(from);
        const b = colOf(to);
        return { left: a * unit, width: (b - a + 1) * unit };
      }
      // The week sits wholly outside the range: collapse at the edge the range would grow in from.
      if (dayDiff(rowLast, start) < 0) return { left: (colOf(rowLast) + 1) * unit, width: 0 };
      return { left: colOf(rowFirst) * unit, width: 0 };
    });
  }, [first, hiKey, loKey, month, rows]);
  const startCell = useMemo(
    () => (loKey && monthDiff(fromKey(loKey), month) === 0 ? cellIn(fromKey(loKey), first) : null),
    [loKey, month, first]
  );
  const endCell = useMemo(
    () =>
      hiKey && hiKey !== loKey && monthDiff(fromKey(hiKey), month) === 0
        ? cellIn(fromKey(hiKey), first)
        : null,
    [hiKey, loKey, month, first]
  );

  return (
    <div className="w-[calc(var(--cell)*7)]">
      <p
        id={titleId}
        className="m-0 h-8 text-center text-sm leading-8 font-medium whitespace-nowrap"
      >
        {formatters.title.format(month)}
      </p>
      <div role="grid" aria-labelledby={titleId} className="grid">
        <div
          role="row"
          className="text-muted-foreground text-ui-sm grid h-7 grid-cols-[repeat(7,var(--cell))] items-center text-center"
        >
          {rows[0]?.map((date) => (
            <span
              key={date.getDay()}
              role="columnheader"
              aria-label={formatters.weekdayLong.format(date)}
            >
              {formatters.weekday.format(date).slice(0, 2)}
            </span>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute inset-0" aria-hidden>
            {segments.map((segment, row) => (
              <Bar key={row} row={row} segment={segment} reduced={reduced || instant} />
            ))}
            <Thumb cell={startCell} reduced={reduced || instant} />
            <Thumb cell={endCell} reduced={reduced || instant} />
          </span>
          {rows.map((row, index) => (
            <div
              key={index}
              role="row"
              className="grid h-(--cell) grid-cols-[repeat(7,var(--cell))]"
            >
              {row.map((date) => {
                const key = keyOf(date);
                if (monthDiff(date, month) !== 0)
                  return <span key={key} role="gridcell" className="relative block" />;
                const disabled = Boolean(
                  (minDate && dayDiff(date, minDate) < 0) || (maxDate && dayDiff(date, maxDate) > 0)
                );
                const inRange = Boolean(
                  lo && hi && dayDiff(date, lo) >= 0 && dayDiff(date, hi) <= 0
                );
                const edge = sameDay(date, lo) || sameDay(date, hi);
                const isToday = sameDay(date, today);
                return (
                  <span
                    key={key}
                    role="gridcell"
                    aria-selected={inRange}
                    className="relative block"
                  >
                    <button
                      type="button"
                      data-date={key}
                      data-edge={edge || undefined}
                      data-today={isToday || undefined}
                      tabIndex={key === tabbable ? 0 : -1}
                      disabled={disabled}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={formatters.day.format(date)}
                      onClick={() => onPick(date)}
                      onPointerEnter={() => {
                        if (!disabled) onHover(date);
                      }}
                      onFocus={() => onFocusDay(date)}
                      onKeyDown={(event) => onKey(event, date)}
                      className={cn(
                        'group/day relative z-1 grid size-full cursor-pointer place-items-center rounded-full text-sm tabular-nums outline-none [-webkit-tap-highlight-color:transparent]',
                        'transition-colors duration-150 motion-reduce:transition-none',
                        'data-edge:text-primary-foreground data-edge:font-medium data-edge:delay-[40ms]',
                        // Today: a dot under the number, inverted when an end sits on it.
                        'data-today:after:bg-primary data-today:data-edge:after:bg-primary-foreground data-today:after:absolute data-today:after:bottom-[5px] data-today:after:left-1/2 data-today:after:size-1 data-today:after:-translate-x-1/2 data-today:after:rounded-full',
                        'disabled:text-muted-foreground disabled:cursor-default disabled:opacity-50'
                      )}
                    >
                      <span
                        className={cn(
                          'relative grid size-[calc(100%-6px)] place-items-center rounded-full transition-[background-color,scale] duration-150 motion-reduce:transition-none',
                          'group-active/day:not-group-disabled/day:scale-90',
                          'group-focus-visible/day:not-group-data-edge/day:bg-foreground/10',
                          '[@media(hover:hover)]:group-hover/day:not-group-disabled/day:not-group-data-edge/day:bg-foreground/[0.07]'
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The visible months travel together; a leaving set turns inert so focus and queries only find the current one. */
function Months({
  children,
  direction,
  reduced,
}: {
  children: ReactNode;
  direction: number;
  reduced: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      className="col-start-1 row-start-1 flex gap-6"
      data-current={present || undefined}
      inert={!present || undefined}
      custom={direction}
      variants={reduced ? fade : slide}
      initial="enter"
      animate="center"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

function DateRangePicker({
  value,
  defaultValue = null,
  onChange,
  id,
  label = 'Date range',
  placeholder = 'Pick dates',
  presets = [],
  minDate,
  maxDate,
  weekStartsOn = 1,
  months = 'auto',
  boundary,
  className,
}: DateRangePickerProps) {
  const reduced = useReducedFlag();
  const today = useToday();
  const uid = useId();
  const [inner, setInner] = useState<DateRange | null>(defaultValue);
  const committed = value !== undefined ? value : inner;

  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [view, setView] = useState<Date>(() => monthStart(committed?.end ?? new Date(2000, 0, 1)));
  const [direction, setDirection] = useState(1);
  const [draft, setDraft] = useState<DateRange | null>(committed);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [keyed, setKeyed] = useState(false);
  const [focusKey, setFocusKey] = useState('');

  const formatters = useMemo<Formatters>(
    () => ({
      title: new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }),
      day: new Intl.DateTimeFormat('en-AU', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      weekday: new Intl.DateTimeFormat('en-AU', { weekday: 'short' }),
      weekdayLong: new Intl.DateTimeFormat('en-AU', { weekday: 'long' }),
    }),
    []
  );

  const hasRail = presets.length > 0;
  const wideMin = hasRail ? 712 : 580;
  const count = compact ? 1 : 2;
  const visible = useMemo(
    () => Array.from({ length: count }, (_, index) => addMonths(view, index)),
    [count, view]
  );
  const shown = anchor ? ordered(anchor, hover ?? anchor) : draft;
  const activePreset =
    today && !anchor ? presets.findIndex((preset) => sameRange(preset.range(today), draft)) : -1;
  const days = shown ? dayDiff(shown.end, shown.start) + 1 : 0;
  const committedDirection = useDirection(committed);
  const shownDirection = useDirection(shown);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'trigger' | 'day' | null>(null);

  /* One surface: the trigger's box springs to the panel's box and back. Before the first
     measurement the surface simply fills the root, so server markup already looks right. */
  const width = useMotionValue<number | string>('100%');
  const height = useMotionValue<number | string>('100%');
  const radius = useMotionValue(8);
  const x = useMotionValue(0);
  const sizes = useRef<{ trigger: Size & { r: number }; panel: Size | null }>({
    trigger: { w: 0, h: 0, r: 8 },
    panel: null,
  });
  const live = useRef({ open: false, reduced: false, ready: false });
  const queued = useRef(false);
  const boundaryRef = useRef(boundary);
  useLayoutEffect(() => {
    boundaryRef.current = boundary;
  }, [boundary]);

  const bounds = useCallback(() => {
    const element = boundaryRef.current?.() ?? clippingParent(rootRef.current);
    const viewport = { left: 0, right: document.documentElement.clientWidth };
    if (!element) return viewport;
    const rect = element.getBoundingClientRect();
    return {
      left: Math.max(viewport.left, rect.left),
      right: Math.min(viewport.right, rect.right),
    };
  }, []);

  const update = useCallback(() => {
    queued.current = false;
    const { trigger, panel } = sizes.current;
    const state = live.current;
    if (!trigger.w) return;
    const openPanel = state.open && panel ? panel : null;
    const target = openPanel ?? trigger;
    let offset = 0;
    if (openPanel && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const box = bounds();
      offset = Math.min(0, box.right - EDGE - (rect.left + openPanel.w));
      offset = Math.max(offset, box.left + EDGE - rect.left);
    }
    const r = openPanel ? PANEL_RADIUS : trigger.r;
    if (!state.ready || state.reduced) {
      width.jump(target.w);
      height.jump(target.h);
      radius.jump(r);
      x.jump(offset);
      state.ready = true;
      return;
    }
    const spring = state.open ? GROW : SHRINK;
    animate(width, target.w, spring);
    animate(height, target.h, spring);
    animate(radius, r, spring);
    animate(x, offset, spring);
  }, [bounds, height, radius, width, x]);

  const schedule = useCallback(() => {
    if (queued.current) return;
    queued.current = true;
    queueMicrotask(update);
  }, [update]);

  useLayoutEffect(() => {
    live.current.open = open;
    live.current.reduced = reduced;
    if (!open) sizes.current.panel = null;
    schedule();
  }, [open, reduced, schedule]);

  useLayoutEffect(() => {
    const node = triggerRef.current;
    if (!node) return;
    const read = () => {
      sizes.current.trigger = {
        w: node.offsetWidth,
        h: node.offsetHeight,
        r: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 8,
      };
      schedule();
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [schedule]);

  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!open || !node) return;
    const read = () => {
      sizes.current.panel = { w: node.offsetWidth, h: node.offsetHeight };
      schedule();
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, schedule]);

  // The CMS scrolls inside panes and dialogs, not the page, so bring the panel into view in
  // whatever scrolls it; after closing, the trigger comes back if that left it out of sight.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: reduced ? 'instant' : 'smooth',
      })
    );
    return () => cancelAnimationFrame(frame);
  }, [open, reduced]);
  // Only after it was open: on mount a field further down a long form is out of sight too, and
  // scrolling to it would open the form halfway down.
  const wasOpen = useRef(open);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight)
      trigger.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
  }, [open, reduced]);

  /* Two months when there is room, one compact month otherwise. */
  const measureLayout = useCallback(() => {
    const box = bounds();
    const available = Math.max(0, box.right - box.left - EDGE * 2);
    const single = months === 1 || (months === 'auto' && available < wideMin);
    return { single, width: Math.min(352, available) };
  }, [bounds, months, wideMin]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const next = measureLayout();
      setCompact(next.single);
      setPanelWidth(next.width);
      schedule();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureLayout, open, schedule]);

  const viewFor = (range: DateRange | null, single: boolean, fallback: Date) => {
    const end = monthStart(range?.end ?? fallback);
    return single ? end : addMonths(end, -1);
  };

  const openPanel = () => {
    if (!today) return;
    const layout = measureLayout();
    setCompact(layout.single);
    setPanelWidth(layout.width);
    setDraft(committed);
    setAnchor(null);
    setHover(null);
    setView(viewFor(committed, layout.single, today));
    setDirection(0);
    setFocusKey(keyOf(committed?.start ?? today));
    pendingFocus.current = 'day';
    setOpen(true);
  };

  const close = useCallback((focus: boolean) => {
    if (focus) pendingFocus.current = 'trigger';
    setDirection(0);
    setOpen(false);
    setAnchor(null);
    setHover(null);
  }, []);

  const apply = () => {
    const next = anchor ? { start: anchor, end: anchor } : draft;
    if (!next) return;
    if (value === undefined) setInner(next);
    onChange?.(next);
    close(true);
  };

  /* Focus */
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    if (target === 'trigger' && !open) {
      pendingFocus.current = null;
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (target === 'day' && open) {
      const node = panelRef.current?.querySelector<HTMLButtonElement>(
        `[data-current] [data-date="${focusKey}"]`
      );
      if (node) {
        pendingFocus.current = null;
        node.focus({ preventScroll: true });
      }
    }
  }, [focusKey, open, view, compact]);

  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [close, open]);

  const onRootKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Stop here, so a dialog around the field stays open.
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };
  const onRootBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (open && next && !event.currentTarget.contains(next)) close(false);
  };

  /* Months and picking */
  const goTo = (next: Date) => {
    const delta = monthDiff(next, view);
    if (!delta) return;
    setDirection(Math.sign(delta));
    setView(next);
  };

  /** Keeps a range on screen: nothing moves when it already fits, otherwise its last month lands on the right. */
  const reveal = (range: DateRange) => {
    const last = addMonths(view, count - 1);
    if (monthDiff(range.start, view) >= 0 && monthDiff(range.end, last) <= 0) return;
    goTo(viewFor(range, compact, range.end));
  };

  const pick = (date: Date) => {
    setFocusKey(keyOf(date));
    if (!anchor) {
      setAnchor(date);
      setHover(date);
      return;
    }
    setDraft(ordered(anchor, date));
    setAnchor(null);
    setHover(null);
  };

  const choosePreset = (preset: DateRangePreset) => {
    if (!today) return;
    const range = preset.range(today);
    setDraft(range);
    setAnchor(null);
    setHover(null);
    setFocusKey(keyOf(range.start));
    reveal(range);
  };

  const onDayKey = (event: ReactKeyboardEvent<HTMLButtonElement>, date: Date) => {
    const weekday = (date.getDay() - weekStartsOn + 7) % 7;
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(date, -1),
      ArrowRight: () => addDays(date, 1),
      ArrowUp: () => addDays(date, -7),
      ArrowDown: () => addDays(date, 7),
      Home: () => addDays(date, -weekday),
      End: () => addDays(date, 6 - weekday),
      PageUp: () => shiftMonths(date, event.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(date, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = clampDate(move(), minDate, maxDate);
    setFocusKey(keyOf(next));
    setKeyed(true);
    if (anchor) setHover(next);
    pendingFocus.current = 'day';
    const last = addMonths(view, count - 1);
    if (monthDiff(next, view) < 0) goTo(monthStart(next));
    else if (monthDiff(next, last) > 0) goTo(addMonths(monthStart(next), -(count - 1)));
  };

  const onRailKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = compact ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-preset]')
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    buttons[(at + (event.key === keys[1] ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };

  /** The day that owns the tab stop: the focused day when on screen, else the range's first visible day, else the 1st. */
  const tabbable = useMemo(() => {
    const onScreen = (date: Date) => visible.some((month) => monthDiff(date, month) === 0);
    if (focusKey && onScreen(fromKey(focusKey))) return focusKey;
    if (shown && onScreen(shown.start)) return keyOf(shown.start);
    return visible[0] ? keyOf(visible[0]) : '';
  }, [focusKey, shown, visible]);

  /* The preset highlight glides between presets. */
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const gw = useMotionValue(0);
  const gh = useMotionValue(0);
  const go = useMotionValue(0);
  useLayoutEffect(() => {
    const rail = railRef.current;
    const node =
      activePreset < 0 ? null : rail?.querySelector<HTMLElement>(`[data-preset="${activePreset}"]`);
    if (!rail || !node) {
      animate(go, 0, { duration: reduced ? 0 : duration.exit });
      return;
    }
    const place = [node.offsetLeft, node.offsetTop, node.offsetWidth, node.offsetHeight] as const;
    if (go.get() < 0.05 || reduced) {
      gx.jump(place[0]);
      gy.jump(place[1]);
      gw.jump(place[2]);
      gh.jump(place[3]);
    } else {
      animate(gx, place[0], GLIDE);
      animate(gy, place[1], GLIDE);
      animate(gw, place[2], GLIDE);
      animate(gh, place[3], GLIDE);
    }
    animate(go, 1, { duration: reduced ? 0 : duration.fast });
    if (
      compact &&
      (node.offsetLeft < rail.scrollLeft ||
        node.offsetLeft + node.offsetWidth > rail.scrollLeft + rail.clientWidth)
    ) {
      rail.scrollTo({ left: node.offsetLeft - 12, behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [activePreset, compact, go, gh, gw, gx, gy, open, reduced]);

  /* Copy */
  const committedText = committed ? rangeLabel(committed) : placeholder;
  const shownText = shown ? rangeLabel(shown) : 'No dates';
  const countText = shown ? `${days} ${days === 1 ? 'day' : 'days'}` : '';
  // One click picks a single day and Apply takes it; a second click makes it a range.
  const countLine = anchor && sameDay(anchor, hover) ? '1 day, or pick an end date' : countText;
  const status = !open
    ? ''
    : anchor
      ? `Starts ${rangeLabel({ start: anchor, end: anchor })}. Choose an end date, or apply for one day.`
      : shown
        ? `${shownText}, ${countText}`
        : '';
  const layoutId = reduced ? undefined : `${uid}-value`;

  const cellSize =
    compact && panelWidth
      ? Math.max(32, Math.min(42, Math.floor((panelWidth - 24) / 7)))
      : WIDE_CELL;

  const quiet = open
    ? reduced
      ? { opacity: 0 }
      : { opacity: 0, filter: `blur(${blur.subtle}px)` }
    : { opacity: 1, filter: 'blur(0px)' };
  const quietTransition = open
    ? { duration: duration.instant, ease: standardEase }
    : { duration: duration.standard, ease: enterEase, delay: reduced ? 0 : 0.1 };

  return (
    // The root holds the trigger's place; the surface floats above it and grows into the panel,
    // so opening never pushes content. Its z-index drops only after the close spring settles.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape and focus-out for the whole picker
    <div
      ref={rootRef}
      data-slot="date-range-picker"
      data-open={open || undefined}
      onKeyDown={onRootKey}
      onBlur={onRootBlur}
      className={cn(
        'group/drp touch:h-11 relative z-0 block h-9 w-full text-sm transition-[z-index] delay-500 duration-0 data-open:z-30 data-open:delay-0',
        className
      )}
    >
      {/* The trigger stays in place under the panel. Its icons fade while the value flies to the panel footer and back. */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-panel` : undefined}
        aria-label={`${label}: ${committedText}`}
        disabled={!today}
        inert={open || undefined}
        onClick={openPanel}
        className="focus-visible:ring-ring/50 touch:h-11 relative z-1 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left whitespace-nowrap outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 disabled:cursor-default"
      >
        <motion.span
          className="text-muted-foreground grid shrink-0 place-items-center"
          initial={false}
          animate={quiet}
          transition={quietTransition}
        >
          <CalendarClockIcon aria-hidden className="size-4" />
        </motion.span>
        {open || !layoutId ? (
          <motion.span
            key="resting"
            className={cn(
              'inline-flex min-w-0 flex-1 overflow-hidden tabular-nums',
              !committed && 'text-muted-foreground'
            )}
            initial={false}
            animate={open ? { opacity: 0 } : { opacity: 1 }}
            transition={quietTransition}
          >
            <Rolling text={committedText} direction={committedDirection} reduced={reduced} />
          </motion.span>
        ) : (
          <motion.span
            key="shared"
            layoutId={layoutId}
            layout="position"
            className={cn(
              'inline-flex min-w-0 flex-1 overflow-hidden tabular-nums',
              !committed && 'text-muted-foreground'
            )}
            transition={SHRINK}
          >
            <Rolling text={committedText} direction={committedDirection} reduced={reduced} />
          </motion.span>
        )}
        <motion.span
          className="text-muted-foreground grid shrink-0 place-items-center"
          initial={false}
          animate={quiet}
          transition={quietTransition}
        >
          <ChevronDownIcon aria-hidden className="size-4" />
        </motion.span>
      </button>

      {/* One material from trigger to panel. The border is an overlay, so it never changes a measurement. */}
      <motion.div
        className={cn(
          'bg-background dark:bg-input/30 absolute top-0 left-0 z-0 overflow-clip transition-[box-shadow,background-color] duration-150',
          'after:border-input after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:transition-colors',
          '[@media(hover:hover)]:not-group-data-open/drp:group-hover/drp:bg-muted dark:[@media(hover:hover)]:not-group-data-open/drp:group-hover/drp:bg-input/50',
          'group-data-open/drp:bg-popover dark:group-data-open/drp:bg-popover group-data-open/drp:after:border-border group-data-open/drp:z-2 group-data-open/drp:shadow-lg'
        )}
        style={{ width, height, borderRadius: radius, x }}
      >
        <AnimatePresence>
          {open && today && (
            <motion.div
              key="panel"
              ref={panelRef}
              id={`${uid}-panel`}
              role="dialog"
              aria-label={label}
              data-compact={compact || undefined}
              className="group/panel absolute top-0 left-0 w-max p-2.5 data-compact:p-2"
              style={
                {
                  '--cell': `${cellSize}px`,
                  width: compact && panelWidth ? panelWidth : undefined,
                } as CSSProperties
              }
              exit={{ opacity: 1, transition: { duration: duration.fast } }}
            >
              <motion.div
                className="flex gap-2.5 group-data-compact/panel:flex-col group-data-compact/panel:gap-2"
                variants={reduced ? faceFade : faceIn}
                initial="hidden"
                animate="shown"
                exit="gone"
              >
                {hasRail && (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- arrow keys move between presets
                  <div
                    ref={railRef}
                    role="group"
                    aria-label="Presets"
                    onKeyDown={onRailKey}
                    className="relative flex w-37 shrink-0 flex-col gap-0.5 border-r pr-2.5 group-data-compact/panel:-mx-2 group-data-compact/panel:w-auto group-data-compact/panel:[scrollbar-width:none] group-data-compact/panel:flex-row group-data-compact/panel:overflow-x-auto group-data-compact/panel:overscroll-x-contain group-data-compact/panel:border-r-0 group-data-compact/panel:border-b group-data-compact/panel:px-2 group-data-compact/panel:pb-2"
                  >
                    <motion.span
                      aria-hidden
                      className="bg-foreground/[0.065] pointer-events-none absolute top-0 left-0 rounded-lg"
                      style={{ x: gx, y: gy, width: gw, height: gh, opacity: go }}
                    />
                    {presets.map((preset, index) => (
                      <button
                        key={preset.label}
                        type="button"
                        data-preset={index}
                        aria-pressed={index === activePreset}
                        onClick={() => choosePreset(preset)}
                        className="text-muted-foreground hover:text-foreground focus-visible:bg-foreground/5 focus-visible:text-foreground aria-pressed:text-foreground relative flex h-8 shrink-0 cursor-pointer items-center rounded-lg px-3 text-left whitespace-nowrap outline-none aria-pressed:font-medium"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className="relative px-0.5 group-data-compact/panel:self-center"
                  onPointerLeave={() => {
                    if (anchor) setHover(null);
                  }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous month"
                    className="absolute top-0 left-0.5 z-2 size-8 rounded-full"
                    onClick={() => goTo(addMonths(view, -1))}
                    disabled={Boolean(minDate && monthDiff(view, minDate) <= 0)}
                  >
                    <ChevronLeftIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next month"
                    className="absolute top-0 right-0.5 z-2 size-8 rounded-full"
                    onClick={() => goTo(addMonths(view, 1))}
                    disabled={Boolean(
                      maxDate && monthDiff(addMonths(view, count - 1), maxDate) >= 0
                    )}
                  >
                    <ChevronRightIcon aria-hidden />
                  </Button>
                  {/* A fixed six-week window stacks the leaving and arriving months in one cell,
                      so the panel never resizes mid-slide. */}
                  <div className="relative grid h-[calc(60px+var(--cell)*6)] overflow-clip [overflow-clip-margin:2px]">
                    <AnimatePresence initial={false} custom={direction}>
                      <Months
                        key={`${keyOf(view)}-${count}`}
                        direction={direction}
                        reduced={reduced}
                      >
                        {visible.map((month) => (
                          <Month
                            key={keyOf(month)}
                            month={month}
                            range={shown}
                            tabbable={tabbable}
                            today={today}
                            minDate={minDate}
                            maxDate={maxDate}
                            weekStartsOn={weekStartsOn}
                            reduced={reduced}
                            formatters={formatters}
                            idBase={uid}
                            onPick={pick}
                            instant={keyed}
                            onHover={(date) => {
                              setKeyed(false);
                              if (anchor) setHover(date);
                            }}
                            onKey={onDayKey}
                            onFocusDay={(date) => setFocusKey(keyOf(date))}
                          />
                        ))}
                      </Months>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              <div className="mt-2.5 flex w-0 min-w-full items-center justify-between gap-3 border-t pt-2.5 pr-0.5 pl-3 group-data-compact/panel:mt-1.5 group-data-compact/panel:flex-wrap group-data-compact/panel:pl-2.5">
                <div className="grid min-w-0 gap-px group-data-compact/panel:flex-[1_1_8rem]">
                  <motion.span
                    layoutId={layoutId}
                    layout={layoutId ? 'position' : undefined}
                    className="inline-flex w-max font-medium tabular-nums"
                    transition={GROW}
                    variants={layoutId ? undefined : faceFade}
                    initial={layoutId ? undefined : 'hidden'}
                    animate={layoutId ? undefined : 'shown'}
                    exit={layoutId ? undefined : 'gone'}
                  >
                    <Rolling text={shownText} direction={shownDirection} reduced={reduced} />
                  </motion.span>
                  <motion.span
                    className="text-muted-foreground inline-flex min-h-[1.4em] text-xs tabular-nums"
                    variants={reduced ? faceFade : faceIn}
                    initial="hidden"
                    animate="shown"
                    exit="gone"
                  >
                    {countLine && (
                      <Rolling text={countLine} direction={shownDirection} reduced={reduced} />
                    )}
                  </motion.span>
                </div>
                <motion.div
                  className="flex shrink-0 items-center gap-1.5 group-data-compact/panel:ml-auto"
                  variants={reduced ? faceFade : faceIn}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  <Button type="button" variant="ghost" size="sm" onClick={() => close(true)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="min-w-19"
                    onClick={apply}
                    disabled={!shown}
                  >
                    Apply
                  </Button>
                </motion.div>
              </div>
              <p className="sr-only" aria-live="polite">
                {status}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export { DateRangePicker };

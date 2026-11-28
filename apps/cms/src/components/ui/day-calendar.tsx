import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
  type Variants,
} from 'motion/react';
import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useWeekStart } from '@/lib/use-week-start';
import { cn } from '@/lib/utils';

// A single-date calendar, ported from a shadcn-registry motion library. Months slide on a strip,
// and the selected disc glides from day to day instead of jumping. Ranges and multi-date picks
// stay on the react-day-picker Calendar (`calendar.tsx`).

type DayCalendarProps = {
  value?: Date;
  onChange?: (date: Date) => void;
  /** The month shown first when there is no value. Defaults to today's. */
  defaultMonth?: Date;
  /** Days before or after these can't be picked, and the arrows stop at their months. */
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: (date: Date) => boolean;
  /** Extra classes for a day, to mark it. Style `before:` for a fill, so the selected disc stays visible. */
  dayClassName?: (date: Date) => string | undefined;
  /** 0 is Sunday. Monday by default, as in Australia. */
  weekStartsOn?: number;
  locale?: string;
  className?: string;
};

const GAP = 4;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const sameDay = (a?: Date, b?: Date) =>
  Boolean(
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
const sameMonth = (a?: Date, b?: Date) =>
  Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth());
const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);
/** Whole months, keeping the day where it exists: 31 January plus a month is 28 February. */
const shiftMonths = (date: Date, amount: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    Math.min(
      date.getDate(),
      new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate()
    )
  );
const isBefore = (a: Date, b?: Date) => Boolean(b && startOfDay(a) < startOfDay(b));
const isAfter = (a: Date, b?: Date) => Boolean(b && startOfDay(a) > startOfDay(b));
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = (key: string) => {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
const fromIndex = (index: number) => new Date(Math.floor(index / 12), ((index % 12) + 12) % 12, 1);

/** Today turns over at local midnight, and is read again when the tab or window comes back. */
function subscribeToday(notify: () => void) {
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
}

/** The viewer's local date; undefined on the server, so markup never depends on the server's clock. */
function useToday() {
  const key = useSyncExternalStore(
    subscribeToday,
    () => dateKey(new Date()),
    () => ''
  );
  return useMemo(() => (key ? fromKey(key) : undefined), [key]);
}

const noSubscribe = () => () => {};
const ease = {
  enter: [0.16, 1, 0.3, 1],
  standard: [0.22, 1, 0.36, 1],
} as const;
const springs = {
  snappy: { type: 'spring', visualDuration: 0.2, bounce: 0 },
  morph: { type: 'spring', visualDuration: 0.3, bounce: 0 },
  strip: { type: 'spring', visualDuration: 0.3, bounce: 0, restDelta: 0.002 },
} as const;

/** The old month title leaves the way the strip travels while the new one arrives from the other side. */
const titleSlide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: ease.enter } },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -12,
    transition: { duration: 0.15, ease: ease.standard },
  }),
};
const titleFade: Variants = {
  enter: { opacity: 1, x: 0 },
  center: { opacity: 1, x: 0, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/**
 * The selected disc of one month, placed by week and weekday rather than measured, so it glides
 * in a straight line between any two days and keeps gliding while the strip slides. It only grows
 * in or fades out when the selection enters or leaves the month.
 */
function SelectionDisc({ cell, reduced }: { cell: number; reduced: boolean }) {
  const visible = cell >= 0;
  const col = useMotionValue(visible ? cell % 7 : 0);
  const row = useMotionValue(visible ? Math.floor(cell / 7) : 0);
  const opacity = useMotionValue(visible ? 1 : 0);
  const scale = useMotionValue(visible ? 1 : 0.7);
  // Each step is one cell plus the gap; percentages resolve against the disc, which is one cell.
  const transform = useTransform(
    () =>
      `translate(calc(${col.get()} * (100% + ${GAP}px)), calc(${row.get()} * (100% + ${GAP}px))) scale(${scale.get()})`
  );
  const hidden = useRef(!visible);
  useLayoutEffect(() => {
    if (!visible) {
      hidden.current = true;
      const fade = reduced ? { duration: 0 } : { duration: 0.15, ease: ease.standard };
      const controls = [animate(opacity, 0, fade), animate(scale, 0.7, fade)];
      return () => controls.forEach((control) => control.stop());
    }
    const nextCol = cell % 7;
    const nextRow = Math.floor(cell / 7);
    const controls: AnimationPlaybackControls[] = [];
    if (hidden.current || reduced) {
      col.jump(nextCol);
      row.jump(nextRow);
    } else {
      controls.push(animate(col, nextCol, springs.morph), animate(row, nextRow, springs.morph));
    }
    hidden.current = false;
    controls.push(
      animate(opacity, 1, reduced ? { duration: 0 } : { duration: 0.15, ease: ease.enter }),
      animate(scale, 1, reduced ? { duration: 0 } : springs.snappy)
    );
    return () => controls.forEach((control) => control.stop());
  }, [cell, visible, reduced, col, row, opacity, scale]);
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 aspect-square w-[calc((100%-24px)/7)]"
      style={{ transform, opacity }}
    >
      <span
        data-slot="disc-fill"
        className="bg-primary absolute inset-0 rounded-full transition-[scale,background-color] duration-150"
      />
    </motion.span>
  );
}

/** One month on the strip. Only the month being navigated to is focusable; one sliding past is inert. */
function MonthPane({
  index,
  position,
  present,
  children,
}: {
  index: number;
  position: MotionValue<number>;
  present: boolean;
  children: ReactNode;
}) {
  const x = useTransform(
    position,
    (value) => `calc(${(index - value) * 100}% + ${(index - value) * 16}px)`
  );
  const opacity = useTransform(position, (value) => 1 - Math.min(1, Math.abs(index - value)) * 0.6);
  return (
    <motion.div
      className="relative col-start-1 row-start-1 min-w-0 will-change-transform has-[[aria-selected=true]:active:not(:disabled)]:**:data-[slot=disc-fill]:scale-94"
      style={{ x, opacity }}
      data-present={present || undefined}
      aria-hidden={present ? undefined : true}
      inert={!present}
    >
      {children}
    </motion.div>
  );
}

function DayCalendar({
  value,
  onChange,
  defaultMonth,
  minDate,
  maxDate,
  disabledDates,
  dayClassName,
  weekStartsOn: weekStartsOnProp,
  locale = 'en-AU',
  className,
}: DayCalendarProps) {
  const titleId = useId();
  // Without one given, weeks start on the day the site chose (Settings, General).
  const siteWeekStart = useWeekStart();
  const weekStartsOn = weekStartsOnProp ?? siteWeekStart;
  const today = useToday();
  // Reduced motion only counts after hydration, so server and client markup agree.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );
  const reduced = (useReducedMotion() ?? false) && hydrated;
  const [chosenMonth, setChosenMonth] = useState(() => {
    const start = value ?? defaultMonth;
    return start ? monthStart(start) : undefined;
  });
  const [focusedDate, setFocusedDate] = useState(value);
  const viewportRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<string | null>(null);
  // Without a value or default month, wait for the client's today and settle on its month once.
  const month = chosenMonth ?? (today && monthStart(today));
  if (!chosenMonth && month) setChosenMonth(month);
  const monthTime = month?.getTime();
  const monthKey = month ? dateKey(month) : 'pending';

  /** Where a date falls in its week, counted from the first day of the week. */
  const column = (date: Date) => (date.getDay() - weekStartsOn + 7) % 7;
  /** Every month shows six weeks, so the grid keeps one height as months change. */
  const firstCell = (paneMonth: Date) => addDays(paneMonth, -column(paneMonth));
  const weeksOf = (paneMonth: Date) => {
    const start = firstCell(paneMonth);
    return Array.from({ length: 6 }, (_, week) =>
      Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day))
    );
  };

  // The direction comes from the month itself, so arrows and keys all travel the same way.
  const [shownMonth, setShownMonth] = useState(monthTime);
  const [direction, setDirection] = useState(0);
  if (shownMonth !== monthTime) {
    setShownMonth(monthTime);
    setDirection(
      shownMonth === undefined || monthTime === undefined ? 0 : monthTime > shownMonth ? 1 : -1
    );
  }

  // The strip position is counted in months. The panes either side of it render, plus the target.
  const target = month ? monthIndex(month) : 0;
  const position = useMotionValue(target);
  const [span, setSpan] = useState<[number, number]>([target, target]);
  useMotionValueEvent(position, 'change', (latest) => {
    const next: [number, number] = [Math.floor(latest + 1e-3), Math.ceil(latest - 1e-3)];
    setSpan((current) => (current[0] === next[0] && current[1] === next[1] ? current : next));
  });
  const ready = month !== undefined;
  const placed = useRef(ready);
  useLayoutEffect(() => {
    if (!ready) return;
    const from = position.get();
    if (from === target) return;
    if (!placed.current || reduced) {
      placed.current = true;
      position.jump(target);
      return;
    }
    // A long jump (a year with Shift) starts a month away, so the strip never scrolls through the rest.
    if (Math.abs(target - from) > 2) position.jump(target - Math.sign(target - from));
    const controls = animate(position, target, springs.strip);
    return () => controls.stop();
  }, [ready, target, reduced, position]);
  const paneIndexes = Array.from(new Set([span[0], span[1], target])).sort((a, b) => a - b);

  const titleFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale]
  );
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 7 January 2024 was a Sunday.
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(2024, 0, 7 + ((i + weekStartsOn) % 7)))
    );
  }, [locale, weekStartsOn]);
  const monthLabel = month ? titleFormat.format(month) : '';

  // The disc glides, so each number changes colour as the disc actually passes it: the day it
  // leaves waits longer on short hops, the day it lands on waits longer on long ones.
  const valueKey = value ? dateKey(value) : '';
  const [last, setLast] = useState({ key: valueKey, date: value });
  const [handoff, setHandoff] = useState({ from: '', to: '', distance: 0 });
  if (last.key !== valueKey) {
    const days =
      last.date && value
        ? Math.round((startOfDay(value).getTime() - startOfDay(last.date).getTime()) / 864e5)
        : 0;
    const columns = last.date && value ? column(value) - column(last.date) : 0;
    setLast({ key: valueKey, date: value });
    setHandoff({
      from: last.key,
      to: valueKey,
      distance: Math.hypot(columns, (days - columns) / 7),
    });
  }
  const numberDelay = (key: string): CSSProperties | undefined => {
    if (!handoff.distance || reduced || (key !== handoff.to && key !== handoff.from))
      return undefined;
    const delay =
      key === handoff.to
        ? Math.min(260, 95 + 85 * Math.log(handoff.distance))
        : Math.max(20, 130 / handoff.distance);
    return { '--number-delay': `${Math.round(delay)}ms` } as CSSProperties;
  };

  const isDisabled = (date: Date) =>
    isBefore(date, minDate) || isAfter(date, maxDate) || Boolean(disabledDates?.(date));
  const previousMonth = month && addMonths(month, -1);
  const nextMonth = month && addMonths(month, 1);
  const previousDisabled = Boolean(previousMonth && minDate && previousMonth < monthStart(minDate));
  const nextDisabled = Boolean(nextMonth && maxDate && nextMonth > monthStart(maxDate));

  // One tab stop: the day last focused, else the selection, else today, else the first open day.
  const tabbableKey = (() => {
    const open = (date?: Date) =>
      date && sameMonth(date, month) && !isDisabled(date) ? dateKey(date) : '';
    const firstOpen = month
      ? weeksOf(month)
          .flat()
          .find((date) => sameMonth(date, month) && !isDisabled(date))
      : undefined;
    return open(focusedDate) || open(value) || open(today) || (firstOpen ? dateKey(firstOpen) : '');
  })();

  const changeMonth = (to: Date) => setChosenMonth(monthStart(to));

  /** Keyboard focus lands on the new day in the same frame the month starts to slide. */
  useLayoutEffect(() => {
    const key = focusRequest.current;
    if (!key) return;
    const button = viewportRef.current?.querySelector<HTMLButtonElement>(
      `[data-present] [data-date="${key}"]`
    );
    if (button) {
      focusRequest.current = null;
      button.focus({ preventScroll: true });
    }
  });

  /** Clamps a keyboard move to the allowed range and steps past blocked days. */
  const moveFocus = (from: Date, to: Date, step: number) => {
    let next =
      isBefore(to, minDate) && minDate
        ? startOfDay(minDate)
        : isAfter(to, maxDate) && maxDate
          ? startOfDay(maxDate)
          : to;
    for (let tries = 0; tries < 42 && isDisabled(next); tries += 1) next = addDays(next, step);
    if (isDisabled(next) || sameDay(next, from)) return;
    setFocusedDate(next);
    focusRequest.current = dateKey(next);
    if (!sameMonth(next, month)) changeMonth(next);
  };

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isDisabled(date)) onChange?.(date);
      return;
    }
    const moves: Record<string, [Date, number]> = {
      ArrowLeft: [addDays(date, -1), -1],
      ArrowRight: [addDays(date, 1), 1],
      ArrowUp: [addDays(date, -7), -1],
      ArrowDown: [addDays(date, 7), 1],
      Home: [addDays(date, -column(date)), 1],
      End: [addDays(date, 6 - column(date)), -1],
      PageUp: [shiftMonths(date, event.shiftKey ? -12 : -1), -1],
      PageDown: [shiftMonths(date, event.shiftKey ? 12 : 1), 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveFocus(date, move[0], move[1]);
  };

  // Six fixed weeks, so a day's cell is its distance from the first day on the grid.
  const cellOf = (paneMonth: Date) => {
    if (!value) return -1;
    const index = Math.round(
      (startOfDay(value).getTime() - firstCell(paneMonth).getTime()) / 864e5
    );
    return index >= 0 && index < 42 ? index : -1;
  };

  const renderMonth = (paneMonth: Date, present: boolean) => (
    <>
      <SelectionDisc cell={cellOf(paneMonth)} reduced={reduced} />
      <div className="grid gap-y-1" role="grid" aria-label={titleFormat.format(paneMonth)}>
        {weeksOf(paneMonth).map((week) => (
          <div key={dateKey(week[0]!)} className="grid grid-cols-7 gap-x-1" role="row">
            {week.map((date) => {
              const key = dateKey(date);
              const selected = sameDay(date, value);
              const isToday = sameDay(date, today);
              const outside = !sameMonth(date, paneMonth);
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  data-date={key}
                  aria-label={date.toLocaleDateString(locale, { dateStyle: 'full' })}
                  aria-selected={selected}
                  aria-current={isToday ? 'date' : undefined}
                  tabIndex={present && key === tabbableKey ? 0 : -1}
                  disabled={isDisabled(date)}
                  style={present ? numberDelay(key) : undefined}
                  className={cn(
                    // The inner circle (::before) carries hover and press, so the hit area never moves.
                    'group/day relative grid aspect-square w-full min-w-0 cursor-pointer place-items-center rounded-full text-sm tabular-nums transition-colors delay-(--number-delay) duration-150 outline-none',
                    'before:absolute before:inset-0 before:rounded-full before:transition-[background-color,scale] before:duration-150',
                    'not-disabled:not-aria-selected:hover:before:bg-muted active:not-disabled:before:scale-94',
                    'focus-visible:ring-ring/50 focus-visible:ring-3',
                    outside && 'text-muted-foreground',
                    (selected || isToday) && 'font-medium',
                    'aria-selected:text-primary-foreground',
                    'disabled:text-muted-foreground disabled:cursor-default',
                    dayClassName?.(date)
                  )}
                  onFocus={() => setFocusedDate(date)}
                  onKeyDown={(event) => onDayKeyDown(event, date)}
                  onClick={() => onChange?.(date)}
                >
                  <span
                    className={cn(
                      'relative transition-[opacity,scale] delay-(--number-delay) duration-150 group-active/day:not-group-disabled/day:scale-94',
                      outside && !selected && 'opacity-80',
                      'group-disabled/day:opacity-40',
                      // Today is a dot under the number, in the number's colour, so it flips with it.
                      isToday &&
                        'after:absolute after:top-[calc(100%+3px)] after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-current'
                    )}
                  >
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <section
      className={cn('w-full min-w-0 py-3 motion-reduce:**:transition-none', className)}
      aria-labelledby={titleId}
    >
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
        <div id={titleId} className="min-w-0 text-sm font-medium">
          <span className="sr-only">{monthLabel}</span>
          {/* Old and new titles share one cell while they cross, so the heading never jumps. */}
          <span className="grid" aria-hidden>
            <AnimatePresence initial={false} custom={direction}>
              {month && (
                <motion.span
                  key={monthKey}
                  className="col-start-1 row-start-1 justify-self-start whitespace-nowrap tabular-nums"
                  custom={direction}
                  variants={reduced || !direction ? titleFade : titleSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {monthLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          {direction ? monthLabel : ''}
        </span>
        <div className="-mr-1.5 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            disabled={previousDisabled}
            onClick={() => previousMonth && changeMonth(previousMonth)}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={nextDisabled}
            onClick={() => nextMonth && changeMonth(nextMonth)}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>
      <div
        aria-hidden
        className="text-muted-foreground mb-1.5 grid grid-cols-7 gap-x-1 text-center text-xs leading-6 font-medium"
      >
        {weekdays.map((day, index) => (
          <span key={`${day}-${index}`} className="min-w-0 overflow-hidden">
            {day.slice(0, 2)}
          </span>
        ))}
      </div>
      {/* Months sit on one strip in a clipped window; panes share one cell, so the height holds. */}
      <div ref={viewportRef} className="relative grid overflow-hidden [contain:paint]">
        {month ? (
          paneIndexes.map((index) => (
            <MonthPane key={index} index={index} position={position} present={index === target}>
              {renderMonth(fromIndex(index), index === target)}
            </MonthPane>
          ))
        ) : (
          <div aria-hidden className="grid gap-y-1">
            {Array.from({ length: 6 }, (_, week) => (
              <div key={week} className="grid grid-cols-7 gap-x-1">
                {Array.from({ length: 7 }, (_, day) => (
                  <span key={day} className="aspect-square" />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export { DayCalendar };

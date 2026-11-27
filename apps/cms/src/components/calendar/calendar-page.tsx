// A month of posts and events together. Read-only: each entry opens its own editor, where it is
// scheduled. A grid on wider screens; on phones, where seven columns would be unreadable, the
// same month as a list of the days that have something on.
import {
  type CalendarMonth,
  type GridDay,
  bucketByDay,
  dayKey,
  monthGrid,
  monthKey,
  parseMonthKey,
  shiftMonth,
  toZoned,
} from '@ll/content';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  AnimatePresence,
  type PanInfo,
  type Variants,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import { CalendarClockIcon, ChevronLeftIcon, ChevronRightIcon, FileText } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buttonVariants } from '@/components/ui/button';
import { displayTime, formatDateTime, zoneName } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import type { CalendarData, CalendarEntry } from '@/server/calendar';

type Filter = 'all' | 'post' | 'event';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** How many entries a day cell shows before "N more". */
const SHOWN = 3;

const STATE_DOT: Record<CalendarEntry['state'], string> = {
  scheduled: 'bg-indigo-500',
  published: 'bg-emerald-500',
  draft: 'bg-neutral-400',
  cancelled: 'bg-red-400',
};
const STATE_WORD: Record<CalendarEntry['state'], string> = {
  scheduled: 'scheduled',
  published: 'published',
  draft: 'draft',
  cancelled: 'cancelled',
};

const monthName = ({ year, month }: CalendarMonth) =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const dayName = (d: GridDay) =>
  new Date(Date.UTC(d.year, d.month, d.day)).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

function timeOf(entry: CalendarEntry, siteZone: string) {
  const wall = toZoned(entry.at, entry.timeZone || siteZone);
  return displayTime(`${wall.hour}:${wall.minute}`);
}

/** What the entry is, for people who cannot see its icon and colour. */
function describe(entry: CalendarEntry, time: string) {
  const what =
    entry.kind === 'post'
      ? `Post, ${STATE_WORD[entry.state]}`
      : entry.kind === 'event'
        ? `Event, ${STATE_WORD[entry.state]}`
        : 'Event goes live';
  return `${what}, ${time}: ${entry.title || 'Untitled'}`;
}

function EntryLink({
  entry,
  siteZone,
  className,
  children,
  ...rest
}: {
  entry: CalendarEntry;
  siteZone: string;
  className?: string;
  children: React.ReactNode;
} & React.ComponentProps<'a'>) {
  const label = describe(entry, timeOf(entry, siteZone));
  const common = { 'aria-label': label, className, ...rest };
  return entry.kind === 'post' ? (
    <Link to="/posts/$postId" params={{ postId: entry.id }} {...common}>
      {children}
    </Link>
  ) : (
    <Link to="/events/$eventId" params={{ eventId: entry.id }} {...common}>
      {children}
    </Link>
  );
}

function EntryIcon({ entry, className }: { entry: CalendarEntry; className?: string }) {
  const Icon = entry.kind === 'post' ? FileText : CalendarClockIcon;
  return <Icon aria-hidden className={cn('text-muted-foreground size-3.5 shrink-0', className)} />;
}

// The date picker's curves, so the two feel alike.
const ease = {
  enter: [0.16, 1, 0.3, 1],
  standard: [0.22, 1, 0.36, 1],
} as const;

// Switching All / Posts / Events: what stays glides into place, what goes fades and lifts away,
// what arrives rises in, a touch later for each one so a group reads as arriving together. A
// month change replaces the whole pane instead, so entries only animate for the filter.
const reveal: Variants = {
  hidden: { opacity: 0, y: 6 },
  shown: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: ease.enter, delay: Math.min(index, 6) * 0.035 },
  }),
  gone: { opacity: 0, y: -4, transition: { duration: 0.12, ease: ease.standard } },
};
const revealReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.12 } },
  gone: { opacity: 0, transition: { duration: 0.08 } },
};

/** An entry, or a day of them, that animates in and out as the filter changes. */
function Reveal({
  index,
  as = 'div',
  className,
  children,
  ...rest
}: {
  index: number;
  as?: 'div' | 'section';
  className?: string;
  children: ReactNode;
} & React.ComponentProps<'div'>) {
  const reduced = !!useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      layout={reduced ? false : 'position'}
      custom={index}
      variants={reduced ? revealReduced : reveal}
      initial="hidden"
      animate="shown"
      exit="gone"
      className={className}
      {...(rest as object)}
    >
      {children}
    </Tag>
  );
}

const kindWord = (entry: CalendarEntry) =>
  entry.kind === 'post' ? 'Post' : entry.kind === 'event' ? 'Event' : 'Event goes live';

/** What a chip is too small to say: its whole title, what it is, when, and where. */
function EntryTip({ entry, siteZone }: { entry: CalendarEntry; siteZone: string }) {
  const zone = entry.timeZone || siteZone;
  // Say so when an event is in another zone than the one every other time here is shown in.
  const away =
    entry.timeZone && entry.timeZone !== siteZone ? ` (${zoneName(zone, entry.at)})` : '';
  return (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="font-medium">{entry.title || 'Untitled'}</span>
      <span className="opacity-70">
        {kindWord(entry)}
        {entry.kind !== 'event-live' && ` · ${STATE_WORD[entry.state]}`}
      </span>
      <span className="opacity-70">
        {formatDateTime(entry.at, zone)}
        {away}
      </span>
      {entry.venue && <span className="opacity-70">{entry.venue}</span>}
    </span>
  );
}

/** One line in a day cell. */
function Chip({ entry, siteZone }: { entry: CalendarEntry; siteZone: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <EntryLink
            entry={entry}
            siteZone={siteZone}
            className="bg-background/70 hover:bg-background focus-visible:ring-ring/50 flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2"
          >
            {/* The title leads, so it keeps the room; when and what kind sit quietly beneath. */}
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', STATE_DOT[entry.state])}
              />
              <span
                className={cn(
                  'truncate font-medium',
                  entry.state === 'cancelled' && 'text-muted-foreground line-through'
                )}
              >
                {entry.title || 'Untitled'}
              </span>
            </span>
            <span className="text-muted-foreground flex items-center gap-1 pl-3 text-[0.6875rem] tabular-nums">
              <EntryIcon entry={entry} className="size-3" />
              {entry.kind === 'event-live' ? 'Live' : timeOf(entry, siteZone)}
            </span>
          </EntryLink>
        }
      />
      <TooltipContent side="top" align="start">
        <EntryTip entry={entry} siteZone={siteZone} />
      </TooltipContent>
    </Tooltip>
  );
}

/** A row on phones: 44pt to tap, with the kind and state spelt out. */
function AgendaRow({ entry, siteZone }: { entry: CalendarEntry; siteZone: string }) {
  const kind =
    entry.kind === 'post' ? 'Post' : entry.kind === 'event' ? 'Event' : 'Event goes live';
  return (
    <EntryLink
      entry={entry}
      siteZone={siteZone}
      className="touch:min-h-11 hover:bg-muted flex items-center gap-3 px-4 py-2.5 outline-none"
    >
      <span className="text-muted-foreground w-16 shrink-0 text-xs tabular-nums">
        {timeOf(entry, siteZone)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'text-ui line-clamp-2',
            entry.state === 'cancelled' && 'text-muted-foreground line-through'
          )}
        >
          {entry.title || 'Untitled'}
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={cn('size-1.5 shrink-0 rounded-full', STATE_DOT[entry.state])}
          />
          {kind}
          {entry.kind !== 'event-live' && ` · ${STATE_WORD[entry.state]}`}
        </span>
      </span>
    </EntryLink>
  );
}

function DayCell({
  day,
  entries,
  today,
  siteZone,
}: {
  day: GridDay;
  entries: CalendarEntry[];
  today: boolean;
  siteZone: string;
}) {
  const shown = entries.slice(0, SHOWN);
  const hidden = entries.length - shown.length;
  return (
    <div
      role="gridcell"
      aria-label={dayName(day)}
      className={cn('bg-muted/50 min-h-28 min-w-0 rounded-lg p-1.5', !day.inMonth && 'bg-muted/20')}
    >
      <span
        className={cn(
          'mb-1 ml-0.5 inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums',
          today ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground',
          !day.inMonth && !today && 'opacity-60'
        )}
      >
        {day.day}
      </span>
      <div className="relative flex flex-col gap-0.5">
        {/* Not on first showing: a new month brings its own entrance. */}
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((entry, index) => (
            <Reveal key={entry.key} index={index}>
              <Chip entry={entry} siteZone={siteZone} />
            </Reveal>
          ))}
        </AnimatePresence>
        {hidden > 0 && (
          <Popover>
            <PopoverTrigger
              className="text-muted-foreground hover:bg-muted w-full rounded-md px-1.5 py-1 text-left text-xs"
              aria-label={`${hidden} more on ${dayName(day)}`}
            >
              {hidden} more
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-0.5 p-2">
              <p className="text-ui px-1.5 pb-1 font-medium">{dayName(day)}</p>
              {entries.map((entry) => (
                <Chip key={entry.key} entry={entry} siteZone={siteZone} />
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// The month slides the way you moved (forward comes in from the right) and the block below it
// follows the new month's height, since a month is four to six weeks tall. Same curves as the
// date picker's month change. Month changes are occasional, so this stays short.
const SLIDE = 48;
const slide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * SLIDE }),
  center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: ease.enter } },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -SLIDE,
    transition: { duration: 0.15, ease: ease.standard },
  }),
};
// Reduced motion keeps the change legible with a fade and drops the travel.
const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
const heightSpring = { type: 'spring', visualDuration: 0.3, bounce: 0 } as const;

/** Swiping to change month is for fingers; with a mouse it would fight text selection and links. */
function subscribeTouch(notify: () => void) {
  const query = window.matchMedia('(hover: none)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
const useTouch = () =>
  useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia('(hover: none)').matches,
    () => false
  );

/** One month's content. Tells its parent how tall it is, so the space it sits in can follow. */
function MonthPane({
  direction,
  reduced,
  animateHeight,
  onHeight,
  children,
}: {
  direction: number;
  reduced: boolean;
  /** This pane arrived because the month changed, so its height is worth animating to. */
  animateHeight: boolean;
  onHeight: (height: number, animate: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Fixed when the pane mounts: the parent's flag flips back once the month has been shown, and
  // reading it again would cancel the height animation it started.
  const arrivedByChange = useRef(animateHeight).current;
  // A pane that is leaving is lifted out of the flow; its size no longer says anything.
  const present = useIsPresent();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !present) return;
    let first = true;
    const report = () => {
      // Only the arrival animates; later size changes (a resized window) follow at once.
      onHeight(element.offsetHeight, first && arrivedByChange);
      first = false;
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [present, arrivedByChange, onHeight]);

  return (
    <motion.div
      ref={ref}
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

export function CalendarPage({ data, now }: { data: CalendarData; now: number }) {
  const siteZone = useTimeZone();
  const navigate = useNavigate({ from: '/calendar/' });
  const reduced = !!useReducedMotion();
  const touch = useTouch();
  const [filter, setFilter] = useState<Filter>('all');
  const month = parseMonthKey(data.month)!;
  const weeks = monthGrid(month);
  const today = dayKey(toZoned(now, siteZone));
  const thisMonth = monthKey(toZoned(now, siteZone));
  const entries = data.entries.filter(
    (e) => filter === 'all' || (filter === 'post' ? e.kind === 'post' : e.kind !== 'post')
  );
  const byDay = bucketByDay(entries, siteZone);
  const previous = monthKey(shiftMonth(month, -1));
  const next = monthKey(shiftMonth(month, 1));
  const days = weeks.flat();
  const busy = days.filter((d) => byDay.has(dayKey(d)) && d.inMonth);

  // Which way the month moved: 1 is forward. "YYYY-MM" sorts as dates do.
  const shown = useRef(data.month);
  const changed = data.month !== shown.current;
  const direction = data.month >= shown.current ? 1 : -1;
  useLayoutEffect(() => {
    shown.current = data.month;
  }, [data.month]);

  const [height, setHeight] = useState<number | null>(null);
  const [heightAnimates, setHeightAnimates] = useState(false);
  // A filter change reshapes the month (on a phone, the list), so the height follows that too.
  const filtered = useRef(0);
  const changeFilter = (next: Filter) => {
    filtered.current = performance.now();
    setFilter(next);
  };
  const onHeight = useCallback((next: number, animate: boolean) => {
    setHeight(next);
    setHeightAnimates(animate || performance.now() - filtered.current < 400);
  }, []);

  // A swipe left goes forward, as turning a page does. A short or slow drag springs back.
  const dragged = useRef(false);
  const go = (to: string) => void navigate({ to: '/calendar', search: { month: to } });
  const onDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    window.setTimeout(() => (dragged.current = false), 50);
    if (Math.abs(offset.x) < 72 && Math.abs(velocity.x) < 500) return;
    go(offset.x < 0 ? next : previous);
  };

  return (
    <div data-slot="stack-page" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 data-slot="page-title" className="text-2xl">
          Content calendar
        </h1>
        {data.includeEvents && (
          <SegmentedControl
            label="Show"
            value={filter}
            onValueChange={changeFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'post', label: 'Posts' },
              { value: 'event', label: 'Events' },
            ]}
            className="max-md:w-full"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/calendar"
          search={{ month: previous }}
          aria-label="Previous month"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          <ChevronLeftIcon aria-hidden />
        </Link>
        <Link
          to="/calendar"
          search={{ month: next }}
          aria-label="Next month"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          <ChevronRightIcon aria-hidden />
        </Link>
        <h2 aria-live="polite" className="text-ui min-w-0 flex-1 truncate px-1 font-semibold">
          {monthName(month)}
        </h2>
        {data.month !== thisMonth && (
          <Link
            to="/calendar"
            search={{}}
            className={buttonVariants({ variant: 'outline', size: 'default' })}
          >
            Today
          </Link>
        )}
      </div>

      {/* The height follows the month; sideways, whatever is sliding is clipped at the edge. */}
      <motion.div
        initial={false}
        animate={{ height: height ?? 'auto' }}
        transition={heightAnimates && !reduced ? heightSpring : { duration: 0 }}
        className="relative overflow-x-clip"
      >
        <motion.div
          className="relative"
          // Vertical scrolling stays the browser's; only a sideways drag is ours.
          style={{ touchAction: 'pan-y' }}
          drag={touch ? 'x' : false}
          dragDirectionLock
          dragSnapToOrigin
          dragElastic={0.2}
          dragMomentum={false}
          onDragStart={() => (dragged.current = true)}
          onDragEnd={onDragEnd}
          // Letting go over a chip after a swipe must not open it.
          onClickCapture={(event) => {
            if (!dragged.current) return;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <MonthPane
              key={data.month}
              direction={direction}
              reduced={reduced}
              animateHeight={changed}
              onHeight={onHeight}
            >
              {/* Wider screens: the month as a grid. */}
              <TooltipProvider delay={400}>
                <div role="grid" aria-label={monthName(month)} className="max-md:hidden">
                  <div role="row" className="text-muted-foreground grid grid-cols-7 gap-1 text-xs">
                    {WEEKDAYS.map((name) => (
                      <div key={name} role="columnheader" className="px-2 pb-1.5">
                        {name}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {weeks.map((week) => (
                      <div key={dayKey(week[0]!)} role="row" className="grid grid-cols-7 gap-1">
                        {week.map((day) => (
                          <DayCell
                            key={dayKey(day)}
                            day={day}
                            entries={byDay.get(dayKey(day)) ?? []}
                            today={dayKey(day) === today}
                            siteZone={siteZone}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </TooltipProvider>

              {/* Phones: only the days with something on. */}
              <div className="md:hidden">
                {busy.length === 0 ? (
                  <p className="text-muted-foreground px-1 py-6 text-center text-sm">
                    Nothing scheduled in {monthName(month)}.
                  </p>
                ) : (
                  <div className="bg-muted/50 rounded-xl">
                    <AnimatePresence initial={false} mode="popLayout">
                      {busy.map((day, dayIndex) => (
                        <Reveal
                          as="section"
                          index={dayIndex}
                          key={dayKey(day)}
                          aria-label={dayName(day)}
                        >
                          <h3
                            className={cn(
                              'bg-muted/40 px-4 py-1.5 text-xs font-medium',
                              dayKey(day) === today && 'text-primary'
                            )}
                          >
                            {dayName(day)}
                            {dayKey(day) === today && ' · Today'}
                          </h3>
                          <div>
                            <AnimatePresence initial={false} mode="popLayout">
                              {byDay.get(dayKey(day))!.map((entry, index) => (
                                <Reveal key={entry.key} index={index}>
                                  <AgendaRow entry={entry} siteZone={siteZone} />
                                </Reveal>
                              ))}
                            </AnimatePresence>
                          </div>
                        </Reveal>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </MonthPane>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

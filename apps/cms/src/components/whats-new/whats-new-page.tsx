import { Link } from '@tanstack/react-router';
import {
  AnimatePresence,
  type Transition,
  type Variants,
  motion,
  useReducedMotion,
} from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckIcon, ChevronDown } from '@/components/icons';
import { useUpdates } from '@/components/shell/updates';
import { Pager } from '@/components/pager';
import { cn } from '@/lib/utils';
import { type WhatsNewEntry, type WhatsNewKind, whatsNew } from '@/lib/whats-new';

/** Notes per page. */
const PAGE_SIZE = 10;
const PAGE_SIZES = [10, 25, 50, 100] as const;

const kinds: { id: WhatsNewKind; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'improved', label: 'Improved' },
];
const kindOf = (entry: WhatsNewEntry): WhatsNewKind => entry.kind ?? 'new';

// Ids carry a suffix when a day has several entries (2026-11-15-8), so take the date alone.
const dateOf = (entry: WhatsNewEntry) => new Date(`${entry.id.slice(0, 10)}T12:00:00`);
const dayLabel = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' });
const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long' });
const monthShort = new Intl.DateTimeFormat('en-AU', { month: 'short' });

type Month = { key: string; name: string; year: string; short: string };
const months: Month[] = [];
for (const entry of whatsNew) {
  const key = entry.id.slice(0, 7);
  if (months.some((m) => m.key === key)) continue;
  const date = dateOf(entry);
  months.push({
    key,
    name: monthName.format(date),
    year: String(date.getFullYear()),
    short: monthShort.format(date),
  });
}
const monthOrder = (key: string) => months.findIndex((m) => m.key === key);

const blurSoft = 'blur(4px)';
const blurSubtle = 'blur(2px)';
const none = 'blur(0px)';
const instant: Transition = { duration: 0 };
const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 34 },
  smooth: { type: 'spring', stiffness: 300, damping: 32 },
  morph: { type: 'spring', stiffness: 400, damping: 32 },
} as const satisfies Record<string, Transition>;
const ease = [0.23, 1, 0.32, 1] as const;

/** Values rise when they grow and fall when they shrink; the outgoing value leaves the opposite way. */
const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 55}%`, filter: blurSubtle }),
  center: { opacity: 1, y: '0%', filter: none },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -55}%`, filter: blurSubtle }),
};
const rise: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: direction * 14, filter: blurSoft }),
  center: { opacity: 1, y: 0, filter: none },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction * -14,
    filter: blurSoft,
    transition: { duration: 0.15, ease },
  }),
};

function RollingNumber({ value, reduce }: { value: number; reduce: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 });
  return (
    <span className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false} custom={state.direction}>
        <motion.span
          key={value}
          custom={state.direction}
          variants={roll}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduce ? instant : spring.snappy}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function EntryRow({
  entry,
  open,
  fresh,
  onToggle,
  reduce,
}: {
  entry: WhatsNewEntry;
  open: boolean;
  fresh: boolean;
  onToggle: () => void;
  reduce: boolean;
}) {
  const panelId = useId();
  const kind = kinds.find((k) => k.id === kindOf(entry))!;
  const layout: Transition = reduce ? instant : spring.smooth;
  const first = entry.items[0];
  return (
    <motion.li
      layout="position"
      className="border-border/60 border-b last:border-b-0"
      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: blurSubtle }}
      animate={{ opacity: 1, filter: none }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.1 } }
          : { opacity: 0, scale: 0.98, filter: blurSubtle, transition: { duration: 0.15, ease } }
      }
      transition={
        reduce
          ? { duration: 0, opacity: { duration: 0.1 } }
          : { opacity: { duration: 0.2 }, filter: { duration: 0.2 }, layout }
      }
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 touch:min-h-11 grid w-full grid-cols-[4.5rem_1fr_auto] items-start gap-x-4 rounded-lg px-2 py-4 text-left transition-colors outline-none focus-visible:ring-2 sm:grid-cols-[6rem_1fr_auto]"
      >
        <time
          dateTime={entry.id.slice(0, 10)}
          className="text-muted-foreground pt-0.5 text-xs tabular-nums"
        >
          {dayLabel.format(dateOf(entry))}
        </time>
        <span className="min-w-0 space-y-1">
          <span className="flex items-center gap-2 text-xs font-medium">
            <i
              aria-hidden
              className={cn(
                'size-1.5 rounded-full not-italic',
                kind.id === 'new' ? 'bg-brand' : 'bg-foreground/40'
              )}
            />
            {kind.label}
            {fresh && (
              <span className="bg-brand/10 text-brand rounded-full px-1.5 py-px text-[0.6875rem]">
                Unread
              </span>
            )}
          </span>
          <span className="text-ui block leading-snug font-semibold">{entry.title}</span>
          {first && (
            <span className="text-muted-foreground text-ui block leading-relaxed">
              {first.title}
              {entry.items.length > 1 && ` and ${entry.items.length - 1} more`}
            </span>
          )}
        </span>
        <motion.span
          aria-hidden
          className="text-muted-foreground pt-0.5"
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? instant : spring.snappy}
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panelId}
            className="overflow-hidden"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0, transition: reduce ? instant : spring.smooth }}
            transition={reduce ? instant : spring.smooth}
          >
            <motion.ul
              className="space-y-4 pr-2 pb-5 pl-2 sm:pl-[7.5rem]"
              initial={{ opacity: 0, y: 8, filter: blurSoft }}
              animate={{ opacity: 1, y: 0, filter: none }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={
                reduce
                  ? { duration: 0, opacity: { duration: 0.1 } }
                  : {
                      y: { ...spring.smooth, delay: 0.06 },
                      opacity: { duration: 0.2, delay: 0.06 },
                      filter: { duration: 0.2, delay: 0.06 },
                    }
              }
            >
              {entry.items.map((item) => (
                <li key={item.title} className="grid grid-cols-[0.375rem_1fr] gap-x-3">
                  {/* Lined up with the first line of the item's title. */}
                  <span
                    aria-hidden
                    className="bg-foreground/30 mt-[0.4375rem] size-1.5 rounded-full"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-ui font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-ui leading-relaxed">{item.body}</p>
                    {item.link && (
                      <Link
                        to={item.link.to}
                        hash={item.link.hash}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 touch:min-h-11 inline-flex items-center gap-1 rounded-sm pt-0.5 text-xs transition-colors outline-none focus-visible:ring-2"
                      >
                        {item.link.label}
                        <ArrowRight aria-hidden className="size-3" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** Every note, newest first, filtered by kind and grouped by month. Opening it counts as having seen them. */
export function WhatsNewPage() {
  const uid = useId();
  const reduce = useReducedMotion() ?? false;
  const { unseen, dismiss } = useUpdates();
  const entries = whatsNew;
  const totalCount = entries.length;
  const kindCounts = useMemo(
    () =>
      kinds.reduce<Record<WhatsNewKind, number>>(
        (counts, kind) => ({
          ...counts,
          [kind.id]: entries.filter((e) => kindOf(e) === kind.id).length,
        }),
        { new: 0, improved: 0 }
      ),
    [entries]
  );

  const [filters, setFilters] = useState<WhatsNewKind[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  // A month on another page: scroll to it once that page has rendered.
  const pendingJump = useRef<string | null>(null);
  const [open, setOpen] = useState<string[]>(() => (entries[0] ? [entries[0].id] : []));
  const [active, setActive] = useState({ key: months[0]?.key ?? '', direction: 1 });
  // Which notes were new on arrival. Seen state is read after mount, and marking
  // them seen empties `unseen`, so the markers are kept here.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const frame = useRef(0);

  useEffect(() => {
    if (unseen.length === 0) return;
    setFreshIds(new Set(unseen.map((entry) => entry.id)));
    setOpen((previous) => [...new Set([...previous, ...unseen.map((e) => e.id)])]);
    dismiss();
  }, [unseen, dismiss]);

  const visible = useMemo(
    () => entries.filter((e) => filters.length === 0 || filters.includes(kindOf(e))),
    [entries, filters]
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageNow = Math.min(page, pageCount);
  const from = (pageNow - 1) * pageSize;
  const shown = useMemo(() => visible.slice(from, from + pageSize), [visible, from, pageSize]);
  // Every month with notes, for the month bar, however many pages they span.
  const allGroups = useMemo(
    () =>
      months
        .map((month) => ({
          ...month,
          count: visible.filter((e) => e.id.startsWith(month.key)).length,
        }))
        .filter((group) => group.count > 0),
    [visible]
  );
  // The months on this page, with only the notes on it.
  const groups = useMemo(
    () =>
      months
        .map((month) => ({ ...month, items: shown.filter((e) => e.id.startsWith(month.key)) }))
        .filter((group) => group.items.length > 0),
    [shown]
  );
  const current = allGroups.find((group) => group.key === active.key) ?? allGroups[0];

  const sync = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || groups.length === 0) return;
    const line = scroller.getBoundingClientRect().top + 28;
    let key = groups[0]!.key;
    for (const group of groups) {
      const element = groupRefs.current.get(group.key);
      if (element && element.getBoundingClientRect().top <= line) key = group.key;
    }
    if (
      scroller.scrollTop > 0 &&
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
    ) {
      key = groups[groups.length - 1]!.key;
    }
    setActive((previous) =>
      previous.key === key
        ? previous
        : { key, direction: monthOrder(key) > monthOrder(previous.key) ? 1 : -1 }
    );
  }, [groups]);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      sync();
    });
  }, [sync]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => onScroll());
    observer.observe(list);
    return () => observer.disconnect();
  }, [onScroll]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const key = pendingJump.current;
    if (!key || !groupRefs.current.has(key)) return;
    pendingJump.current = null;
    requestAnimationFrame(() => jumpTo(key));
  }, [pageNow]);

  function toggleFilter(kind: WhatsNewKind) {
    setPage(1);
    setFilters((previous) =>
      previous.includes(kind) ? previous.filter((item) => item !== kind) : [...previous, kind]
    );
  }
  function toggleEntry(id: string) {
    setOpen((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
  }
  function goToPage(next: number) {
    setPage(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }
  function jumpTo(key: string) {
    const index = visible.findIndex((e) => e.id.startsWith(key));
    const target = Math.floor(index / pageSize) + 1;
    if (index >= 0 && target !== pageNow) {
      pendingJump.current = key;
      setPage(target);
      return;
    }
    const scroller = scrollRef.current;
    const element = groupRefs.current.get(key);
    if (!scroller || !element) return;
    const top =
      scroller.scrollTop +
      element.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: Math.max(0, top - 1), behavior: reduce ? 'auto' : 'smooth' });
  }

  const shownLabel =
    filters.length === 0 ? `${totalCount} updates` : `${visible.length} of ${totalCount} updates`;
  const layout: Transition = reduce ? instant : spring.smooth;

  return (
    <section
      data-slot="stack-page"
      aria-labelledby={`${uid}-title`}
      className="mx-auto flex w-full max-w-3xl flex-col"
    >
      <header className="mb-6 space-y-1">
        <h1
          id={`${uid}-title`}
          data-slot="page-title"
          className="text-xl font-semibold tracking-tight"
        >
          What's new
        </h1>
        <p className="text-muted-foreground text-sm">
          {entries[0] ? `Latest: ${entries[0].title}` : 'Changes to the CMS, newest first.'}
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div role="group" aria-label="Filter by type" className="flex flex-wrap items-center gap-2">
          {kinds.map((kind) => {
            const on = filters.includes(kind.id);
            return (
              <button
                key={kind.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFilter(kind.id)}
                className="text-ui hover:bg-muted aria-pressed:bg-muted focus-visible:ring-ring/50 touch:min-h-11 inline-flex h-8 items-center gap-2 rounded-full border px-3 transition-colors outline-none focus-visible:ring-2"
              >
                <motion.span
                  aria-hidden
                  className={cn(
                    'flex items-center justify-center rounded-full',
                    kind.id === 'new' ? 'bg-brand' : 'bg-foreground/40',
                    on && 'text-background'
                  )}
                  initial={false}
                  animate={{ width: on ? 16 : 7, height: on ? 16 : 7 }}
                  transition={reduce ? instant : spring.morph}
                >
                  <motion.span
                    initial={false}
                    animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.7 }}
                    transition={reduce ? instant : { ...spring.snappy, delay: on ? 0.05 : 0 }}
                  >
                    <CheckIcon className="size-2.5" strokeWidth={3} />
                  </motion.span>
                </motion.span>
                <span>{kind.label}</span>
                <span className="text-muted-foreground tabular-nums">{kindCounts[kind.id]}</span>
              </button>
            );
          })}
          <AnimatePresence initial={false}>
            {filters.length > 0 && (
              <motion.button
                key="clear"
                type="button"
                onClick={() => {
                  setPage(1);
                  setFilters([]);
                }}
                className="text-muted-foreground hover:text-foreground text-ui touch:min-h-11 rounded-sm px-1"
                initial={{ opacity: 0, x: -6, filter: blurSubtle }}
                animate={{ opacity: 1, x: 0, filter: none }}
                exit={{ opacity: 0, x: -4, filter: blurSubtle, transition: { duration: 0.1 } }}
                transition={reduce ? instant : spring.snappy}
              >
                Show all
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <p aria-hidden className="text-muted-foreground text-ui flex items-center gap-1">
          <motion.span
            className="text-foreground font-medium"
            layout="position"
            transition={layout}
          >
            <RollingNumber value={visible.length} reduce={reduce} />
          </motion.span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={filters.length === 0 ? 'all' : 'some'}
              initial={{ opacity: 0, filter: blurSubtle }}
              animate={{ opacity: 1, filter: none }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduce ? instant : { duration: 0.2 }}
            >
              {filters.length === 0 ? 'updates' : `of ${totalCount} updates`}
            </motion.span>
          </AnimatePresence>
        </p>
        <p className="sr-only" role="status" aria-live="polite">{`Showing ${shownLabel}`}</p>
      </div>

      <div className="bg-background/90 mb-1 flex items-center justify-between gap-4 border-y py-2">
        <div aria-hidden className="flex items-baseline gap-3">
          <span className="relative inline-flex overflow-hidden text-sm font-semibold">
            <AnimatePresence mode="popLayout" initial={false} custom={active.direction}>
              <motion.span
                key={current?.key ?? 'none'}
                custom={active.direction}
                variants={rise}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduce ? instant : spring.morph}
              >
                {current ? (
                  <>
                    {current.name}
                    <span className="text-muted-foreground font-normal"> {current.year}</span>
                  </>
                ) : (
                  'No updates'
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          <motion.span
            className="text-muted-foreground text-ui flex gap-1"
            layout="position"
            transition={layout}
          >
            <RollingNumber value={current?.count ?? 0} reduce={reduce} />
            {current?.count === 1 ? 'update' : 'updates'}
          </motion.span>
        </div>
        <nav aria-label="Jump to month" className="flex gap-0.5 overflow-x-auto">
          {allGroups.map((group) => {
            const selected = group.key === current?.key;
            return (
              <button
                key={group.key}
                type="button"
                aria-label={`Jump to ${group.name} ${group.year}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => jumpTo(group.key)}
                className="text-ui touch:min-h-11 relative rounded-full px-3 py-1 transition-colors aria-[current]:font-medium"
              >
                {selected && (
                  <motion.span
                    layoutId={`${uid}-month`}
                    className="bg-muted absolute inset-0 rounded-full"
                    transition={reduce ? instant : spring.morph}
                  />
                )}
                <span className="relative">{group.short}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <motion.div
        layoutScroll
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Release notes"
        className="focus-visible:ring-ring/50 h-[calc(100svh-17rem)] min-h-80 overflow-y-auto rounded-lg outline-none focus-visible:ring-2"
      >
        <div ref={listRef}>
          <AnimatePresence mode="popLayout" initial={false}>
            {groups.map((group, index) => (
              <motion.section
                key={group.key}
                layout="position"
                aria-labelledby={`${uid}-${group.key}`}
                ref={(element: HTMLElement | null) => {
                  if (element) groupRefs.current.set(group.key, element);
                  else groupRefs.current.delete(group.key);
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ layout, opacity: { duration: reduce ? 0.1 : 0.2 } }}
              >
                <h2
                  id={`${uid}-${group.key}`}
                  className={cn(
                    index === 0
                      ? 'sr-only'
                      : 'text-muted-foreground px-2 pt-6 pb-1 text-xs font-medium'
                  )}
                >
                  {group.name} {group.year}
                </h2>
                <ul>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {group.items.map((entry, i) => (
                      <EntryRow
                        key={`${entry.id}-${i}`}
                        entry={entry}
                        open={open.includes(entry.id)}
                        fresh={freshIds.has(entry.id)}
                        onToggle={() => toggleEntry(entry.id)}
                        reduce={reduce}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
          <motion.p
            layout="position"
            transition={{ layout }}
            className="text-muted-foreground py-8 text-center text-xs"
          >
            That is everything so far.
          </motion.p>
        </div>
      </motion.div>

      {/* With no more notes than the smallest page, there is nothing to page or to choose. */}
      {visible.length > PAGE_SIZES[0] && (
        <Pager
          page={pageNow}
          pageCount={pageCount}
          total={visible.length}
          pageSize={pageSize}
          noun="notes"
          label="What's new pages"
          onPageChange={goToPage}
          rows={{
            options: PAGE_SIZES,
            // A new page size starts again from the first page.
            onChange: (rows) => {
              setPageSize(rows);
              goToPage(1);
            },
          }}
        />
      )}
    </section>
  );
}

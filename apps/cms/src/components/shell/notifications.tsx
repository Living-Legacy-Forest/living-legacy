import { can } from '@ll/content';
import { Link } from '@tanstack/react-router';
import {
  AnimatePresence,
  type HTMLMotionProps,
  type TargetAndTransition,
  type Transition,
  type Variants,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import {
  type ComponentProps,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  LegalDocumentIcon,
  MailIcon,
  MailOpenIcon,
  PencilLineIcon,
  XIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerBody, DrawerContent } from '@/components/ui/drawer';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { GlideHighlight } from '@/components/ui/glide-highlight';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { type Notification, getNotifications } from '@/server/notifications';
import { SheetHeader, sheetGroupClass } from './sheet-parts';

// Read and dismissed are a per-browser convenience, so storage failures are harmless.
const STORE_KEY = 'cms:notifications';
/** The old "seen up to" timestamp: anything older than it starts out read. */
const LEGACY_SEEN_KEY = 'cms:notifications-seen';

type Marks = { read: string[]; dismissed: string[] };
type View = 'all' | 'unread';

const noMarks: Marks = { read: [], dismissed: [] };
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

function loadMarks(): { marks: Marks; legacySeen: number } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    return {
      marks: parsed
        ? { read: strings(parsed.read), dismissed: strings(parsed.dismissed) }
        : noMarks,
      legacySeen: Number(localStorage.getItem(LEGACY_SEEN_KEY)) || 0,
    };
  } catch {
    return { marks: noMarks, legacySeen: 0 };
  }
}
function saveMarks(marks: Marks) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(marks));
    localStorage.removeItem(LEGACY_SEEN_KEY);
  } catch {
    // Private mode or blocked storage: marks just reset next visit.
  }
}

/** Keyed by when it was asked too, so a post sent back for review a second time shows again. */
const keyOf = (item: Notification) => `${item.id}@${item.at}`;

const ease = { enter: [0.16, 1, 0.3, 1], standard: [0.22, 1, 0.36, 1] } as const;
const spring = {
  /** Toggles, badges and small indicators. */
  snappy: { type: 'spring', visualDuration: 0.2, bounce: 0 },
  /** Heights and shared highlights; critically damped, so nothing overshoots. */
  smooth: { type: 'spring', visualDuration: 0.3, bounce: 0 },
} as const;
const enter: Transition = { duration: 0.2, ease: ease.enter };
const exitFast: Transition = { duration: 0.14, ease: ease.standard };
const instant: Transition = { duration: 0 };
const fadeOut: TargetAndTransition = { opacity: 0, transition: { duration: 0.1 } };
const textIn: TargetAndTransition = { opacity: 0, y: '0.3em', filter: 'blur(4px)' };
const textOut: TargetAndTransition = {
  opacity: 0,
  y: '-0.3em',
  filter: 'blur(2px)',
  transition: exitFast,
};
const iconIn: TargetAndTransition = { opacity: 0, scale: 0.6, filter: 'blur(2px)' };
const shown: TargetAndTransition = { opacity: 1, y: '0em', scale: 1, filter: 'blur(0px)' };
/** Bulk actions cascade down the list, capped so the sweep stays under a quarter second. */
const cascade = (index: number) => Math.min(index * 0.035, 0.2);

/** Outgoing copies are hidden from screen readers while they fade, so live text reads only the new value. */
function Swap(props: HTMLMotionProps<'span'>) {
  const present = useIsPresent();
  return <motion.span {...props} aria-hidden={present ? props['aria-hidden'] : true} />;
}

function SwapText({ children, reduce }: { children: string; reduce: boolean }) {
  return (
    <span className="relative inline-block max-w-full align-top">
      <AnimatePresence mode="popLayout" initial={false}>
        <Swap
          key={children}
          className="block"
          initial={reduce ? { opacity: 0 } : textIn}
          animate={shown}
          exit={reduce ? fadeOut : textOut}
          transition={reduce ? instant : enter}
        >
          {children}
        </Swap>
      </AnimatePresence>
    </span>
  );
}

const roll: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: direction >= 0 ? '0.7em' : '-0.7em',
    filter: 'blur(2px)',
  }),
  center: { opacity: 1, y: '0em', filter: 'blur(0px)' },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction >= 0 ? '-0.7em' : '0.7em',
    filter: 'blur(2px)',
    transition: exitFast,
  }),
};

/** Counts roll like an odometer: a higher number rises from below, a lower one drops from above. */
function RollingCount({
  value,
  display = String(value),
  reduce,
}: {
  value: number;
  display?: string;
  reduce: boolean;
}) {
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState(0);
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1);
    setPrevious(value);
  }
  return (
    <span className="relative inline-grid align-top">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <Swap
          key={display}
          className="block"
          custom={direction}
          variants={reduce ? undefined : roll}
          initial={reduce ? { opacity: 0 } : 'enter'}
          animate={reduce ? { opacity: 1 } : 'center'}
          exit={reduce ? fadeOut : 'exit'}
          transition={reduce ? instant : { y: spring.snappy, opacity: exitFast, filter: exitFast }}
        >
          {display}
        </Swap>
      </AnimatePresence>
    </span>
  );
}

/** What each kind of notification says and where it leads. */
function describe(item: Notification) {
  switch (item.kind) {
    case 'review':
      return { Icon: PencilLineIcon, preview: 'Waiting for your review' };
    case 'legal_review':
      return { Icon: LegalDocumentIcon, preview: 'Waiting for your review' };
    default:
      return { Icon: CalendarClockIcon, preview: `New booking for ${item.partySize}` };
  }
}

function NotificationLink({
  item,
  ref,
  ...props
}: { item: Notification; ref?: Ref<HTMLAnchorElement> } & Omit<ComponentProps<'a'>, 'ref'>) {
  if (item.kind === 'review')
    return <Link ref={ref} to="/posts/$postId" params={{ postId: item.postId }} {...props} />;
  if (item.kind === 'legal_review')
    return <Link ref={ref} to="/legal/$slug" params={{ slug: item.slug }} {...props} />;
  return <Link ref={ref} to="/events/$eventId" params={{ eventId: item.eventId }} {...props} />;
}

/**
 * The bell: what is for this person to act on, with an unread count. Opening a row marks it
 * read; rows can also be marked read or unread, dismissed, or cleared once read. A sheet on phones.
 */
export function Notifications({ user }: { user: SessionUser }) {
  const isPhone = useIsMobile();
  const reduce = useReducedMotion() ?? false;
  const layoutId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [marks, setMarks] = useState<Marks>(noMarks);
  const [view, setView] = useState<View>('all');
  /** Set by Mark all read and Clear read, so their rows leave in a cascade rather than at once. */
  const [bulk, setBulk] = useState(false);
  const legacySeen = useRef(0);
  const rowLinks = useRef(new Map<string, HTMLAnchorElement>());
  const viewButtons = useRef(new Map<View, HTMLButtonElement>());

  const update = useCallback((change: (current: Marks) => Marks) => {
    setMarks((current) => {
      const next = change(current);
      saveMarks(next);
      return next;
    });
  }, []);

  const load = useCallback(() => {
    getNotifications().then(
      (list) => {
        setItems(list);
        const legacy = legacySeen.current;
        legacySeen.current = 0;
        // Forget marks for notifications that have gone, so storage stays small.
        const keys = new Set(list.map(keyOf));
        update((current) => {
          const read = new Set(current.read.filter((key) => keys.has(key)));
          if (legacy) for (const item of list) if (item.at <= legacy) read.add(keyOf(item));
          return { read: [...read], dismissed: current.dismissed.filter((key) => keys.has(key)) };
        });
      },
      () => setItems([])
    );
  }, [update]);

  useEffect(() => {
    const stored = loadMarks();
    legacySeen.current = stored.legacySeen;
    setMarks(stored.marks);
    load();
    // Refresh when the tab regains focus, so the count stays current.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const readKeys = new Set(marks.read);
  const dismissedKeys = new Set(marks.dismissed);
  const isRead = (item: Notification) => readKeys.has(keyOf(item));
  const live = (items ?? []).filter((item) => !dismissedKeys.has(keyOf(item)));
  const unreadCount = live.filter((item) => !isRead(item)).length;
  const readCount = live.length - unreadCount;
  const visible = view === 'unread' ? live.filter((item) => !isRead(item)) : live;
  const summary = unreadCount ? `${unreadCount} waiting for you` : 'You’re all caught up';

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setBulk(false);
  };
  const close = () => onOpenChange(false);

  /** A row is about to leave: keep focus in the list instead of losing it to the page. */
  const focusAfter = (item: Notification) => {
    const index = visible.findIndex((entry) => entry.id === item.id);
    const next = visible[index + 1] ?? visible[index - 1];
    requestAnimationFrame(() =>
      (next ? rowLinks.current.get(keyOf(next)) : viewButtons.current.get(view))?.focus()
    );
  };

  const setRead = (item: Notification, read: boolean) => {
    if (read && view === 'unread') focusAfter(item);
    setBulk(false);
    const key = keyOf(item);
    update((current) => ({
      ...current,
      read: read ? [...current.read, key] : current.read.filter((k) => k !== key),
    }));
  };

  const dismiss = (item: Notification) => {
    focusAfter(item);
    setBulk(false);
    update((current) => ({ ...current, dismissed: [...current.dismissed, keyOf(item)] }));
  };

  const markAllRead = () => {
    setBulk(true);
    update((current) => ({
      ...current,
      read: [...new Set([...current.read, ...live.map(keyOf)])],
    }));
    requestAnimationFrame(() => viewButtons.current.get(view)?.focus());
  };

  const clearRead = () => {
    setBulk(true);
    update((current) => ({
      ...current,
      dismissed: [...current.dismissed, ...live.filter(isRead).map(keyOf)],
    }));
    requestAnimationFrame(() => viewButtons.current.get(view)?.focus());
  };

  const showView = (next: View) => {
    setBulk(false);
    setView(next);
  };

  const heightTransition: Transition = reduce ? instant : { height: spring.smooth, opacity: enter };
  const collapse: TargetAndTransition = reduce
    ? fadeOut
    : { height: 0, opacity: 0, transition: { height: spring.smooth, opacity: exitFast } };

  const triggerProps = {
    variant: 'ghost',
    size: 'icon-sm',
    'aria-label': unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications',
    className: 'text-muted-foreground relative max-md:size-11 max-md:[&_svg]:size-5.5',
  } as const;
  const bell = (
    <>
      <motion.span
        className="grid place-items-center"
        animate={{ rotate: open && !reduce ? -12 : 0 }}
        transition={reduce ? instant : spring.snappy}
      >
        <BellIcon aria-hidden />
      </motion.span>
      <AnimatePresence initial={false}>
        {unreadCount > 0 && (
          <motion.span
            key="badge"
            aria-hidden
            className="ring-background absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center overflow-hidden rounded-full bg-sky-500 px-1 text-[0.625rem] leading-none font-medium text-white tabular-nums ring-2 max-md:top-1 max-md:right-0.5"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? fadeOut : { opacity: 0, scale: 0.6, transition: exitFast }}
            transition={reduce ? instant : spring.snappy}
          >
            <RollingCount
              value={unreadCount}
              display={unreadCount > 9 ? '9+' : String(unreadCount)}
              reduce={reduce}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );

  const toolbar = (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        isPhone ? 'px-4 pb-3' : 'border-b px-2.5 pb-2'
      )}
    >
      <div
        className="inline-flex items-center gap-0.5"
        role="group"
        aria-label="Show notifications"
      >
        {(['all', 'unread'] as const).map((next) => (
          <button
            key={next}
            ref={(node) => {
              if (node) viewButtons.current.set(next, node);
              else viewButtons.current.delete(next);
            }}
            type="button"
            aria-pressed={view === next}
            onClick={() => showView(next)}
            className={cn(
              'text-muted-foreground hover:text-foreground aria-pressed:text-foreground focus-visible:ring-ring/50 relative isolate rounded-md px-2.5 transition-colors outline-none focus-visible:ring-2',
              isPhone ? 'h-8 min-w-16 text-[0.9375rem]' : 'h-7 min-w-14 text-xs'
            )}
          >
            {view === next && (
              <motion.span
                aria-hidden
                layoutId={`${layoutId}-view`}
                className={cn(
                  'absolute inset-0 -z-10 rounded-md',
                  isPhone ? 'bg-(--ios-fill)' : 'bg-muted'
                )}
                transition={reduce ? instant : spring.smooth}
              />
            )}
            {next === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {unreadCount > 0 && (
          <motion.button
            key="mark-all"
            type="button"
            onClick={markAllRead}
            className={cn(
              'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-md whitespace-nowrap transition-colors outline-none focus-visible:ring-2 [&_svg]:size-3.5',
              isPhone ? 'text-tint min-h-11 text-[0.9375rem] [&_svg]:size-4.5' : 'px-1 py-1 text-xs'
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, filter: 'blur(2px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={reduce ? fadeOut : { opacity: 0, filter: 'blur(2px)', transition: exitFast }}
            transition={reduce ? instant : enter}
          >
            <CheckCheckIcon aria-hidden />
            Mark all read
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );

  const skeleton = (
    <div className={cn('space-y-2', isPhone ? 'pt-1' : 'p-3')}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded',
            isPhone ? 'bg-background h-14 rounded-xl' : 'bg-muted h-9'
          )}
        />
      ))}
    </div>
  );

  const list = (
    // Rows collapse their own height on the way out, so the list and the panel close up together.
    <ul
      aria-label={view === 'all' ? 'All notifications' : 'Unread notifications'}
      className={cn(
        isPhone ? sheetGroupClass : 'no-scrollbar min-h-0 overflow-y-auto overscroll-contain p-1'
      )}
    >
      {!isPhone && (
        <GlideHighlight
          follow="hover"
          as="li"
          selector="[data-slot=notification-row]"
          className="bg-muted/60"
        />
      )}
      <AnimatePresence initial={false} custom={bulk}>
        {visible.map((item, index) => {
          const read = isRead(item);
          const key = keyOf(item);
          const { Icon, preview } = describe(item);
          return (
            <motion.li
              key={key}
              custom={bulk}
              className="overflow-hidden"
              variants={{
                exit: (isBulk: boolean) =>
                  reduce
                    ? fadeOut
                    : {
                        height: 0,
                        opacity: 0,
                        transition: {
                          height: { ...spring.smooth, delay: isBulk ? cascade(index) : 0 },
                          opacity: { ...exitFast, delay: isBulk ? cascade(index) : 0 },
                        },
                      },
              }}
              initial={reduce ? { opacity: 0 } : { height: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit="exit"
              transition={heightTransition}
            >
              <div
                data-slot="notification-row"
                className={cn(
                  'group/row relative flex items-center',
                  isPhone
                    ? 'min-h-11 gap-1 py-1.5 pr-1.5 pl-4 transition-colors has-[a:active]:bg-(--ios-fill)'
                    : 'has-[:focus-visible]:bg-muted gap-1 rounded-md py-2 pr-1 pl-2'
                )}
              >
                <NotificationLink
                  item={item}
                  ref={(node) => {
                    if (node) rowLinks.current.set(key, node);
                    else rowLinks.current.delete(key);
                  }}
                  onClick={() => {
                    if (!read) setRead(item, true);
                    close();
                  }}
                  className={cn(
                    'flex min-w-0 flex-1 items-start outline-none after:absolute after:inset-0',
                    isPhone ? 'gap-3' : 'gap-2.5'
                  )}
                >
                  <span
                    className={cn(
                      'text-muted-foreground mt-0.5 flex shrink-0',
                      isPhone ? '[&_svg]:size-5' : '[&_svg]:size-4'
                    )}
                  >
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="flex items-center gap-1.5">
                      {!read && <span className="sr-only">Unread: </span>}
                      <span
                        className={cn(
                          'truncate font-medium transition-colors',
                          isPhone ? 'text-[0.9375rem]' : 'text-ui',
                          read && 'text-muted-foreground'
                        )}
                      >
                        {item.title}
                      </span>
                      <AnimatePresence initial={false} custom={bulk}>
                        {!read && (
                          <motion.span
                            key="dot"
                            aria-hidden
                            custom={bulk}
                            className="size-1.5 shrink-0 rounded-full bg-sky-500"
                            variants={{
                              exit: (isBulk: boolean) =>
                                reduce
                                  ? fadeOut
                                  : {
                                      opacity: 0,
                                      scale: 0.7,
                                      transition: {
                                        ...exitFast,
                                        delay: isBulk ? cascade(index) : 0,
                                      },
                                    },
                            }}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit="exit"
                            transition={reduce ? instant : spring.snappy}
                          />
                        )}
                      </AnimatePresence>
                    </span>
                    <span
                      className={cn(
                        'text-muted-foreground mt-0.5 block truncate',
                        isPhone ? 'text-[0.8125rem]' : 'text-xs'
                      )}
                    >
                      {preview} · {formatRelative(item.at)}
                    </span>
                  </span>
                </NotificationLink>
                {/* Above the link's full-row hit area. Hover or focus shows them; touch screens always do. */}
                <div className="touch:opacity-100 relative z-10 flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 group-has-[:focus-visible]/row:opacity-100">
                  <Button
                    variant="ghost"
                    size={isPhone ? 'icon' : 'icon-xs'}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={read ? `Mark ${item.title} unread` : `Mark ${item.title} read`}
                    title={read ? 'Mark unread' : 'Mark read'}
                    onClick={() => setRead(item, !read)}
                  >
                    <span className="relative grid place-items-center">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <Swap
                          key={read ? 'unread' : 'read'}
                          className="grid place-items-center"
                          initial={reduce ? { opacity: 0 } : iconIn}
                          animate={shown}
                          exit={reduce ? fadeOut : { ...iconIn, transition: exitFast }}
                          transition={reduce ? instant : spring.snappy}
                        >
                          {read ? <MailIcon aria-hidden /> : <MailOpenIcon aria-hidden />}
                        </Swap>
                      </AnimatePresence>
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size={isPhone ? 'icon' : 'icon-xs'}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Dismiss ${item.title}`}
                    title="Dismiss"
                    onClick={() => dismiss(item)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </div>
              </div>
            </motion.li>
          );
        })}
        {/* Opens on the spring the rows close on, so the panel morphs between them instead of
            stacking both. After a bulk action it waits for the cascade, so it never grows first. */}
        {visible.length === 0 && (
          <motion.li
            key="empty"
            className="overflow-hidden"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={collapse}
            transition={
              reduce
                ? instant
                : {
                    height: { ...spring.smooth, delay: bulk ? cascade(3) : 0 },
                    opacity: { ...enter, delay: 0.15 },
                  }
            }
          >
            <Empty className={cn('py-10', isPhone && 'bg-background rounded-xl')}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>
                  <SwapText reduce={reduce}>
                    {view === 'unread' ? 'Nothing unread' : 'Nothing for you right now'}
                  </SwapText>
                </EmptyTitle>
                <EmptyDescription>
                  {view === 'unread'
                    ? 'You’ve read everything waiting for you.'
                    : 'Posts sent to you for review and new event bookings show up here.'}
                </EmptyDescription>
              </EmptyHeader>
              {view === 'unread' && live.length > 0 && (
                <Button variant="link" size="sm" onClick={() => showView('all')}>
                  Show all
                </Button>
              )}
            </Empty>
          </motion.li>
        )}
      </AnimatePresence>
    </ul>
  );

  // Team history is on its own page; the bell only points there.
  const history = can(user, 'posts:publish') && (
    <Link
      to="/activity"
      onClick={close}
      className={cn(
        'hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-2',
        isPhone ? 'text-tint min-h-11 content-center' : 'text-muted-foreground'
      )}
    >
      See all team activity
    </Link>
  );
  const footer = (
    <AnimatePresence initial={false}>
      {(history || readCount > 0) && (
        <motion.div
          key="footer"
          className="shrink-0 overflow-hidden"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={collapse}
          transition={heightTransition}
        >
          <div
            className={cn(
              'flex items-center justify-between gap-3',
              isPhone ? 'mt-2 px-1 text-[0.9375rem]' : 'text-ui min-h-10 border-t px-3'
            )}
          >
            {history || <span />}
            <AnimatePresence initial={false}>
              {readCount > 0 && (
                <motion.button
                  key="clear"
                  type="button"
                  onClick={clearRead}
                  className={cn(
                    'hover:text-foreground focus-visible:ring-ring/50 rounded-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2',
                    isPhone ? 'text-tint min-h-11' : 'text-muted-foreground'
                  )}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={
                    reduce ? fadeOut : { opacity: 0, filter: 'blur(2px)', transition: exitFast }
                  }
                  transition={reduce ? instant : enter}
                >
                  Clear <RollingCount value={readCount} reduce={reduce} /> read
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const summaryLine = (
    <p
      aria-live="polite"
      className={cn(
        'text-muted-foreground',
        isPhone ? 'px-4 pb-3 text-[0.8125rem]' : 'mt-0.5 text-xs'
      )}
    >
      <SwapText reduce={reduce}>{summary}</SwapText>
    </p>
  );

  if (isPhone) {
    return (
      <>
        <Button {...triggerProps} onClick={() => onOpenChange(true)}>
          {bell}
        </Button>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="bg-(--ios-grouped)">
            <SheetHeader title="Notifications" onDone={close} />
            {summaryLine}
            {toolbar}
            <DrawerBody className="pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              {items === null ? skeleton : list}
              {footer}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button {...triggerProps} />}>{bell}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(36rem,calc(100dvh-5rem))] w-[min(24rem,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 px-3 pt-3 pb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-ui font-medium">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-muted text-muted-foreground grid h-5 min-w-5 place-items-center overflow-hidden rounded-md px-1.5 text-xs leading-none tabular-nums">
                  <RollingCount value={unreadCount} reduce={reduce} />
                </span>
              )}
            </div>
            {summaryLine}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground -mt-0.5 -mr-1"
            aria-label="Close notifications"
            onClick={close}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        {toolbar}
        {items === null ? skeleton : list}
        {footer}
      </PopoverContent>
    </Popover>
  );
}

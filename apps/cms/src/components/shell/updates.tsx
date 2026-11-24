import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GiftIcon, RotateCcwIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { isNewerDeploy } from '@/lib/build-check';
import { cn } from '@/lib/utils';
import { type WhatsNewEntry, unseenEntries, whatsNew } from '@/lib/whats-new';

const SEEN_KEY = 'cms:whats-new-seen';
const RUNNING_COMMIT = import.meta.env.VITE_APP_COMMIT;
const CHECK_EVERY_MS = 10 * 60_000;

type Updates = {
  /** The newer notes this person has not dismissed, newest first. */
  unseen: WhatsNewEntry[];
  /** A newer CMS has been deployed since this tab loaded. */
  newDeploy: boolean;
  dismiss: () => void;
};

const UpdatesContext = createContext<Updates | null>(null);

export function useUpdates() {
  const value = useContext(UpdatesContext);
  if (!value) throw new Error('useUpdates needs UpdatesProvider');
  return value;
}

// "Seen" is a per-browser convenience, like the notification bell's, so
// storage failures are harmless: the note just shows again.
function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function writeSeen(id: string) {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    // Private mode or blocked storage.
  }
}

/** Asks the server which build is deployed now. */
async function deployedCommit(): Promise<string | null> {
  try {
    const res = await fetch('/api/build', { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { commit?: string }).commit ?? null;
  } catch {
    return null;
  }
}

/**
 * What's new notes and the "new version ready" notice, shared by the sidebar
 * card, the phone strip and the dashboard's What's new link.
 */
export function UpdatesProvider({ joinedAt, children }: { joinedAt: number; children: ReactNode }) {
  // Read after mount: storage does not exist while rendering on the server.
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  const [newDeploy, setNewDeploy] = useState(false);

  useEffect(() => setSeen(readSeen()), []);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const deployed = await deployedCommit();
      if (!stopped && isNewerDeploy(RUNNING_COMMIT, deployed)) setNewDeploy(true);
    };
    // A page whose code came from an older deploy cannot load once that
    // deploy's files are gone: say so instead of failing.
    const onPreloadError = (event: Event) => {
      event.preventDefault();
      setNewDeploy(true);
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  const unseen = useMemo(
    () => (seen === undefined ? [] : unseenEntries(whatsNew, seen, joinedAt)),
    [seen, joinedAt]
  );

  const value = useMemo<Updates>(
    () => ({
      unseen,
      newDeploy,
      dismiss: () => {
        const latest = whatsNew[0]?.id;
        if (!latest) return;
        writeSeen(latest);
        setSeen(latest);
      },
    }),
    [unseen, newDeploy]
  );

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const CLOSE = { type: 'spring', visualDuration: 0.3, bounce: 0 } as const;

/**
 * Dismissing is rare, so the note leaves rather than vanishes: it fades and goes back where it
 * came from (`lift`: the sidebar card down, the phone strip up) while the space it held closes,
 * so what is around it glides into place instead of jumping. `gap` is the spacing its container
 * puts after it, closed with it. Nothing animates in: it is there when the page is. Reduced
 * motion fades only.
 */
function Leaves({
  show,
  lift,
  gap = 0,
  className,
  children,
}: {
  show: boolean;
  lift: number;
  gap?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduced = !!useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="note"
          className={className}
          exit={
            reduced
              ? { opacity: 0, pointerEvents: 'none', transition: { duration: 0.1 } }
              : {
                  opacity: 0,
                  y: lift,
                  height: 0,
                  marginBottom: -gap,
                  overflow: 'hidden',
                  // Already going: a second tap on it must not open the notes.
                  pointerEvents: 'none',
                  transition: {
                    opacity: { duration: 0.15, ease: EASE_OUT },
                    y: { duration: 0.2, ease: EASE_OUT },
                    height: CLOSE,
                    marginBottom: CLOSE,
                  },
                }
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The sidebar card above View website. Hidden when the sidebar is icons only. */
function SidebarCard() {
  const { unseen, newDeploy, dismiss } = useUpdates();
  const show = newDeploy || unseen.length > 0;
  const box =
    'text-ui bg-sidebar-accent/60 text-sidebar-foreground mx-2 flex flex-col gap-2 rounded-lg border p-3 group-data-[collapsible=icon]:hidden';

  // Built here, not inside the wrapper, so a note that is leaving keeps what it was showing.
  const note = !show ? null : newDeploy ? (
    <div role="status" className={box}>
      <p>The CMS has been updated. Reload to get the latest version.</p>
      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  ) : (
    <div role="status" className={cn(box, 'relative')}>
      <div className="min-w-0">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <GiftIcon aria-hidden className="size-3.5" />
          What's new
        </div>
        <p className="mt-1 pr-5 font-medium">{unseen[0]!.title}</p>
      </div>
      <Button size="sm" variant="outline" className="self-start" render={<Link to="/whats-new" />}>
        See what's new
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Dismiss"
        className="absolute top-2 right-2"
        onClick={dismiss}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );

  return (
    <Leaves show={show} lift={8}>
      {note}
    </Leaves>
  );
}

/**
 * Phones: one slim line above the page, so it never pushes the page title far
 * down. Tapping it opens the notes; the cross dismisses them.
 */
function PhoneStrip() {
  const { unseen, newDeploy, dismiss } = useUpdates();
  const show = newDeploy || unseen.length > 0;
  const strip =
    'bg-muted/70 flex h-11 items-center gap-1 rounded-full border pl-3.5 pr-1 text-[0.9375rem] md:hidden';

  const note = !show ? null : newDeploy ? (
    <div role="status" className={strip}>
      <RotateCcwIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate pl-1.5">The CMS has been updated</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-tint h-11 shrink-0 px-3 font-semibold active:opacity-50"
      >
        Reload
      </button>
    </div>
  ) : (
    <div role="status" className={strip}>
      <Link
        to="/whats-new"
        className="flex h-11 min-w-0 flex-1 items-center gap-2 text-left active:opacity-60"
      >
        <GiftIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">New: </span>
          <span className="font-medium">{unseen[0]!.title}</span>
        </span>
      </Link>
      <button
        type="button"
        aria-label="Dismiss what's new"
        onClick={dismiss}
        className="text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full active:opacity-50"
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  );

  // The page below sits 1rem (gap-4) under the strip: closed with it, so the page title does not
  // jump when the strip is finally removed. Hidden from md up, where there is no strip.
  return (
    <Leaves show={show} lift={-8} gap={16} className="md:hidden">
      {note}
    </Leaves>
  );
}

export const SidebarUpdateCard = SidebarCard;
export const PhoneUpdateStrip = PhoneStrip;

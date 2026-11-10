import { Link } from '@tanstack/react-router';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowRight, MegaphoneIcon, RotateCcwIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  openDialog: (which: 'unseen' | 'all') => void;
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
  const [dialog, setDialog] = useState<'unseen' | 'all' | null>(null);

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
      openDialog: setDialog,
      dismiss: () => {
        const latest = whatsNew[0]?.id;
        if (!latest) return;
        writeSeen(latest);
        setSeen(latest);
      },
    }),
    [unseen, newDeploy]
  );

  const shown = dialog === 'all' ? whatsNew : unseen;
  // However the dialog closes (button, outside click or following a link),
  // having opened the new notes counts as seeing them.
  const closeDialog = () => {
    if (dialog === 'unseen') value.dismiss();
    setDialog(null);
  };

  return (
    <UpdatesContext.Provider value={value}>
      {children}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          initialFocus={false}
          className="max-h-[85svh] gap-0 overflow-y-auto p-0 sm:max-w-md"
        >
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>What's new</DialogTitle>
            <DialogDescription className="sr-only">
              Changes to the CMS, newest first.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y">
            {shown.map((entry) => (
              <section key={entry.id} className="space-y-4 px-5 py-5">
                <header className="space-y-1">
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {new Date(`${entry.id}T12:00:00`).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <h3 className="text-sm leading-snug font-semibold">{entry.title}</h3>
                </header>
                <ul className="border-border space-y-4 border-l pl-4">
                  {entry.items.map((item) => (
                    <li key={item.title} className="relative space-y-1">
                      {/* A dot on the rule, so each item reads as a step. */}
                      <span
                        aria-hidden
                        className="bg-foreground/25 absolute top-1.5 -left-[1.2rem] size-1.5 rounded-full"
                      />
                      <p className="text-ui font-medium">{item.title}</p>
                      <p className="text-muted-foreground text-ui leading-relaxed">{item.body}</p>
                      {item.link && (
                        <Link
                          to={item.link.to}
                          hash={item.link.hash}
                          onClick={closeDialog}
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 touch:min-h-11 inline-flex items-center gap-1 rounded-sm pt-0.5 text-xs transition-colors outline-none focus-visible:ring-2"
                        >
                          {item.link.label}
                          <ArrowRight aria-hidden className="size-3" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </UpdatesContext.Provider>
  );
}

/** The notice itself, as a sidebar card or a strip above the page on phones. */
function UpdateNotice({ variant }: { variant: 'card' | 'strip' }) {
  const { unseen, newDeploy, openDialog, dismiss } = useUpdates();
  if (!newDeploy && unseen.length === 0) return null;

  const card = variant === 'card';
  const box = cn(
    'text-ui flex gap-2',
    card
      ? 'bg-sidebar-accent/60 text-sidebar-foreground mx-2 flex-col rounded-lg border p-3 group-data-[collapsible=icon]:hidden'
      : 'bg-muted/60 items-center rounded-lg border px-3 py-2 md:hidden'
  );

  if (newDeploy) {
    return (
      <div role="status" className={box}>
        <p className={card ? '' : 'flex-1'}>
          The CMS has been updated. Reload to get the latest version.
        </p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          <RotateCcwIcon aria-hidden data-icon="inline-start" />
          Reload
        </Button>
      </div>
    );
  }

  const latest = unseen[0]!;
  return (
    <div role="status" className={cn(box, 'relative')}>
      <div className={cn('min-w-0', !card && 'flex-1')}>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MegaphoneIcon aria-hidden className="size-3.5" />
          What's new
        </p>
        <p className={cn('font-medium', card ? 'mt-1 pr-5' : 'line-clamp-2')}>{latest.title}</p>
      </div>
      <Button
        size="sm"
        variant={card ? 'outline' : 'ghost'}
        className={card ? 'self-start' : 'touch:min-h-11 shrink-0'}
        onClick={() => openDialog('unseen')}
      >
        {card ? "See what's new" : 'View'}
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Dismiss"
        className={card ? 'absolute top-2 right-2' : 'touch:size-11 shrink-0'}
        onClick={dismiss}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}

export const SidebarUpdateCard = () => <UpdateNotice variant="card" />;
export const PhoneUpdateStrip = () => <UpdateNotice variant="strip" />;

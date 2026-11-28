import type { LegalValues } from '@ll/content';
import { useState } from 'react';
import { PostPreviewBody } from '@/components/posts/post-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/notify';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import { getLegalRevision } from '@/server/legal-pages';

type Entry = { id: string; createdAt: number; by: string | null };
type Opened = LegalValues & { id: string; createdAt: number; live: boolean };

/** Every published version, newest (live) first, each readable as it was and restorable. */
export function LegalHistory({
  history,
  restoreReplacesEdits,
  onRestore,
}: {
  history: Entry[];
  /** There is a draft or unsaved edits, which a restore would replace. */
  restoreReplacesEdits: boolean;
  /** Copies the version into the draft; true once done. */
  onRestore: (id: string) => Promise<boolean>;
}) {
  const timeZone = useTimeZone();
  const [open, setOpen] = useState<Opened | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function show(entry: Entry, live: boolean) {
    setLoading(entry.id);
    try {
      const values = await getLegalRevision({ data: { id: entry.id } });
      setOpen({ ...values, id: entry.id, live });
    } catch (error) {
      notify.error('Could not open that version', error);
    } finally {
      setLoading(null);
    }
  }

  async function restore() {
    if (!open) return;
    setRestoring(true);
    const done = await onRestore(open.id);
    setRestoring(false);
    if (done) setOpen(null);
  }

  return (
    <section className="space-y-3" aria-labelledby="legal-history">
      <h2 id="legal-history" className="font-medium">
        History
      </h2>
      {history.length === 0 ? (
        <p className="text-muted-foreground text-xs">Each version you publish is kept here.</p>
      ) : (
        <ol className="relative">
          {/* The line joining the versions, through the middle of their dots. */}
          <span aria-hidden className="bg-border absolute top-2 bottom-2 left-[3.5px] w-px" />
          {history.map((entry, i) => {
            const live = i === 0;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => show(entry, live)}
                  className="hover:bg-muted/60 focus-visible:ring-ring/50 touch:min-h-11 -mx-2 grid w-[calc(100%+1rem)] grid-cols-[0.5rem_1fr_auto] items-start gap-x-3 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-3 disabled:opacity-70"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'relative mt-1 size-2 rounded-full ring-3 ring-[var(--background)]',
                      live ? 'bg-success' : 'bg-muted-foreground/50'
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium tabular-nums">
                      {formatDateTime(entry.createdAt, timeZone)}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {entry.by ?? 'Publisher not recorded'}
                    </span>
                  </span>
                  {loading === entry.id ? (
                    <Spinner className="mt-0.5" />
                  ) : live ? (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[0.625rem] max-md:h-5 max-md:text-[0.6875rem]"
                    >
                      Live
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <Dialog open={open !== null} onOpenChange={(o) => !o && !restoring && setOpen(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>
              {open
                ? `${open.live ? 'Live version, published' : 'Published'} ${formatDateTime(open.createdAt, timeZone)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {open && <PostPreviewBody body={open.body} />}
          {open && !open.live && (
            <DialogFooter className="items-center sm:justify-between">
              <p className="text-muted-foreground text-xs">
                {restoreReplacesEdits
                  ? 'Restoring replaces the changes not yet published.'
                  : 'Restoring makes this the draft. The live page changes when you publish.'}
              </p>
              <Button size="sm" disabled={restoring} onClick={restore}>
                {restoring && <Spinner />}
                Restore as draft
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

import type { LegalValues } from '@ll/content';
import { useState } from 'react';
import { PostPreviewBody } from '@/components/posts/post-preview';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/format';
import { notify } from '@/lib/notify';
import { useTimeZone } from '@/lib/use-time-zone';
import { getLegalRevision } from '@/server/legal-pages';

type Entry = { id: string; createdAt: number; by: string | null };

/** Every published version, newest first, each readable as it was. */
export function LegalHistory({ history }: { history: Entry[] }) {
  const timeZone = useTimeZone();
  const [open, setOpen] = useState<(LegalValues & { createdAt: number }) | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function show(id: string) {
    setLoading(id);
    try {
      setOpen(await getLegalRevision({ data: { id } }));
    } catch (error) {
      notify.error('Could not open that version', error);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-ui font-medium">History</h2>
      {history.length === 0 ? (
        <p className="text-muted-foreground text-xs">No published versions yet.</p>
      ) : (
        <ul className="space-y-1">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="flex-1 text-xs">
                {formatDate(entry.createdAt, timeZone)}
                {entry.by ? ` · ${entry.by}` : ''}
              </span>
              <Button
                variant="ghost"
                size="xs"
                disabled={loading !== null}
                onClick={() => show(entry.id)}
              >
                {loading === entry.id ? <Spinner /> : 'View'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>
              {open ? `As published on ${formatDate(open.createdAt, timeZone)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {open && <PostPreviewBody body={open.body} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

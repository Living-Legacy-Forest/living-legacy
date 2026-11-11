import { formatDate, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import type { LegalPageEditorData } from '@/server/legal-pages';

/** Where the page stands: live, changed since, or waiting for an admin, and since when. */
export function LegalStatus({ data, dirty }: { data: LegalPageEditorData; dirty: boolean }) {
  const timeZone = useTimeZone();
  const changed = data.hasDraft || dirty;
  const state = data.reviewRequestedAt
    ? { label: 'Waiting for review', dot: 'bg-sky-500' }
    : changed
      ? { label: 'Unpublished changes', dot: 'bg-amber-500' }
      : data.lastPublishedAt
        ? { label: 'Published', dot: 'bg-emerald-500' }
        : { label: 'Not published yet', dot: 'bg-muted-foreground' };
  const publisher = data.history[0]?.by;

  return (
    <section className="space-y-1.5" aria-label="Status">
      <p className="flex items-center gap-2 font-medium">
        <span className={cn('size-2 shrink-0 rounded-full', state.dot)} aria-hidden />
        {state.label}
      </p>
      <div className="text-muted-foreground space-y-0.5 pl-4 text-xs">
        {data.lastPublishedAt && (
          <p>
            Last published {formatDate(data.lastPublishedAt, timeZone)}
            {publisher && ` by ${publisher}`}
          </p>
        )}
        {dirty ? (
          <p>Edits not saved yet</p>
        ) : data.hasDraft ? (
          <p>Draft saved {formatRelative(data.updatedAt)}</p>
        ) : null}
        {data.reviewRequestedAt && <p>Review asked for {formatRelative(data.reviewRequestedAt)}</p>}
      </div>
    </section>
  );
}

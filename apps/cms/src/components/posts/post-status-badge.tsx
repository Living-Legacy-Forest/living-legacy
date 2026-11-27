import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';

const styles = {
  draft: { dot: 'bg-neutral-400', label: 'Draft' },
  scheduled: { dot: 'bg-indigo-500', label: 'Scheduled' },
  published: { dot: 'bg-emerald-500', label: 'Published' },
  changes: { dot: 'bg-amber-500', label: 'Unpublished changes' },
  review: { dot: 'bg-sky-500', label: 'In review' },
  trash: { dot: 'bg-red-400', label: 'In trash' },
};

/** Linear-style status: a small coloured dot and a word. */
export function PostStatusBadge({
  status,
  hasDraft = false,
  trashed = false,
  inReview = false,
  scheduledAt = null,
  showDate = false,
  dotOnly = false,
  className,
}: {
  status: 'draft' | 'published';
  hasDraft?: boolean;
  trashed?: boolean;
  /** An author asked for this post to be reviewed. */
  inReview?: boolean;
  /** Set when a draft is scheduled to go live. */
  scheduledAt?: number | null;
  /** Append the scheduled time, for example "Scheduled · 2 Nov, 9:00 am". */
  showDate?: boolean;
  /** Just the coloured dot, named for screen readers and on hover, for a dense row. */
  dotOnly?: boolean;
  className?: string;
}) {
  const key = trashed
    ? 'trash'
    : inReview
      ? 'review'
      : status === 'published'
        ? hasDraft
          ? 'changes'
          : 'published'
        : scheduledAt
          ? 'scheduled'
          : 'draft';
  const { dot, label } = styles[key];
  const timeZone = useTimeZone();
  if (dotOnly) {
    return (
      <span title={label} className={cn('inline-flex shrink-0 items-center', className)}>
        <span aria-hidden className={cn('size-2 rounded-full', dot)} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-xs', className)}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot)} />
      {label}
      {key === 'scheduled' && showDate && scheduledAt && (
        <span className="text-muted-foreground">· {formatDateTime(scheduledAt, timeZone)}</span>
      )}
    </span>
  );
}

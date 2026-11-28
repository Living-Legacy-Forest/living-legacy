import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { StatusBadge, type StatusKind } from '@/components/status-badge';

/** A post's status, worked out from its state, in the shared status style. */
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
  const key: StatusKind = trashed
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
  const timeZone = useTimeZone();
  return (
    <StatusBadge
      kind={key}
      dotOnly={dotOnly}
      className={className}
      after={
        key === 'scheduled' && showDate && scheduledAt ? (
          <span className="text-muted-foreground">· {formatDateTime(scheduledAt, timeZone)}</span>
        ) : null
      }
    />
  );
}

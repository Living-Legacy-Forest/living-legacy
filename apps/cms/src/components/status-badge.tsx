import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Where a post, page or item stands. Every list and preview names it the same way. */
export type StatusKind = 'draft' | 'scheduled' | 'published' | 'changes' | 'review' | 'trash';

export const STATUS_STYLES: Record<StatusKind, { dot: string; label: string }> = {
  draft: { dot: 'bg-muted-foreground/60', label: 'Draft' },
  scheduled: { dot: 'bg-scheduled', label: 'Scheduled' },
  published: { dot: 'bg-success', label: 'Published' },
  changes: { dot: 'bg-warning', label: 'Unpublished changes' },
  review: { dot: 'bg-info', label: 'In review' },
  trash: { dot: 'bg-destructive', label: 'In trash' },
};

/** Linear-style status: a small coloured dot and a word. */
export function StatusBadge({
  kind,
  dotOnly = false,
  after,
  className,
}: {
  kind: StatusKind;
  /** Just the coloured dot, named for screen readers and on hover, for a dense row. */
  dotOnly?: boolean;
  /** Shown after the word, such as the time a scheduled post goes live. */
  after?: ReactNode;
  className?: string;
}) {
  const { dot, label } = STATUS_STYLES[kind];
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
      {after}
    </span>
  );
}

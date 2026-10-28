import { cn } from '@/lib/utils';

const styles = {
  draft: { dot: 'bg-neutral-400', label: 'Draft' },
  published: { dot: 'bg-emerald-500', label: 'Published' },
  changes: { dot: 'bg-amber-500', label: 'Unpublished changes' },
  trash: { dot: 'bg-red-400', label: 'In trash' },
};

/** Linear-style status: a small coloured dot and a word. */
export function PostStatusBadge({
  status,
  hasDraft = false,
  trashed = false,
  className,
}: {
  status: 'draft' | 'published';
  hasDraft?: boolean;
  trashed?: boolean;
  className?: string;
}) {
  const key = trashed ? 'trash' : status === 'draft' ? 'draft' : hasDraft ? 'changes' : 'published';
  const { dot, label } = styles[key];
  return (
    <span
      className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-xs', className)}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}

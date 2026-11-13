import { cn } from '@/lib/utils';

/** A two-line column in a wide row: the value, then a quieter caption. A dash when empty. */
export function RowCell({
  primary,
  secondary,
  className,
}: {
  primary: string;
  secondary?: string;
  className?: string;
}) {
  return (
    <span className={cn('min-w-0', className)}>
      <span
        className={cn(
          'block truncate tabular-nums',
          primary ? 'text-foreground/80' : 'text-muted-foreground/50'
        )}
      >
        {primary || '-'}
      </span>
      {secondary && (
        <span className="text-muted-foreground mt-0.5 block truncate">{secondary}</span>
      )}
    </span>
  );
}

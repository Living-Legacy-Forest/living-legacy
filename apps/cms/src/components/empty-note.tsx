import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A short "nothing here" line inside a card, list or panel, where the full Empty state would be
 * too much. `boxed` gives it the soft grey box of its own, for one that stands alone on the page.
 */
export function EmptyNote({
  children,
  boxed = false,
  className,
}: {
  children: ReactNode;
  boxed?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-muted-foreground px-4 py-8 text-center text-sm',
        boxed && 'bg-muted/50 rounded-lg',
        className
      )}
    >
      {children}
    </p>
  );
}

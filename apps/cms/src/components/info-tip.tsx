import type { ReactNode } from 'react';
import { CircleHelpIcon } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A small "?" that holds the detail a screen would otherwise print under every field. It opens
 * on hover with a mouse and on tap on a touch screen, which has no hover, so it is a popover
 * rather than a tooltip. Links inside it stay clickable.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** What the button is called for screen readers, such as "About Google Analytics". */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        openOnHover
        delay={120}
        closeDelay={100}
        aria-label={label}
        className={cn(
          // The hit area reaches 44pt on touch without making the row taller.
          'text-muted-foreground hover:text-foreground focus-visible:ring-ring data-popup-open:text-foreground touch:after:-inset-3.5 relative inline-flex size-4 shrink-0 items-center justify-center rounded-full outline-none after:absolute after:-inset-2 focus-visible:ring-2',
          className
        )}
      >
        <CircleHelpIcon aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-64 gap-1.5 p-3 text-xs leading-relaxed max-md:text-[0.9375rem]"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

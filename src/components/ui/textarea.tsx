import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-ink-soft/60 hover:border-bark/50 focus-visible:border-ring focus-visible:ring-ring/20 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/15 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-36 w-full resize-y rounded-lg border bg-white px-4 py-3 text-base transition-[border-color,box-shadow] duration-200 outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-4',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };

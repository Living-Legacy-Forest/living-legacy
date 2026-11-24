import logoMark from '@/assets/brand/logo-mark.webp';
import { cn } from '@/lib/utils';

/** The Living Legacy mark: the sidebar's, and the left of the phone's top bar. */
export function Logo({ className }: { className?: string }) {
  return (
    // White artwork painted in the brand colour via a CSS mask (plain white in dark mode).
    <span
      aria-hidden
      className={cn('bg-brand inline-block size-5 shrink-0 dark:bg-white', className)}
      style={{
        WebkitMask: `url(${logoMark}) center / contain no-repeat`,
        mask: `url(${logoMark}) center / contain no-repeat`,
      }}
    />
  );
}

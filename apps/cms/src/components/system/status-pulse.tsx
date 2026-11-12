import type { StatusTone } from '@/lib/system-status';
import { cn } from '@/lib/utils';

const DOT: Record<StatusTone, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

/**
 * A coloured dot with a soft pulse and a word, in the Linear style of the post
 * status. The word carries the meaning, so colour is never the only signal.
 * No pulse for people who ask for less motion.
 */
export function StatusPulse({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-muted-foreground inline-flex items-center gap-2 text-xs whitespace-nowrap',
        className
      )}
    >
      <span aria-hidden className="relative flex size-2 shrink-0">
        <span
          className={cn(
            'absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping motion-safe:[animation-duration:2s]',
            DOT[tone]
          )}
        />
        <span className={cn('relative inline-flex size-2 rounded-full', DOT[tone])} />
      </span>
      {label}
    </span>
  );
}

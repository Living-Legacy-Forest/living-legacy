import { GlobeIcon } from '@/components/icons';
import { FLAG_CODES } from '@/lib/flag-codes';
import { cn } from '@/lib/utils';

/**
 * A country's flag, from its two-letter code: Untitled UI's free flag icons, served from
 * /flags. A flag is a picture, so it looks the same on every system (a flag emoji does not
 * draw on Windows). Without a flag for the code, a globe stands in. Decorative: the country's
 * name is always written beside it.
 */
export function Flag({ code, className }: { code: string | null | undefined; className?: string }) {
  const upper = code?.toUpperCase();
  if (!upper || !FLAG_CODES.has(upper)) {
    return (
      <GlobeIcon
        aria-hidden
        className={cn('text-muted-foreground h-3.5 w-5 shrink-0', className)}
      />
    );
  }
  return (
    <img
      src={`/flags/${upper}.svg`}
      alt=""
      width={20}
      height={14}
      loading="lazy"
      decoding="async"
      className={cn(
        'h-3.5 w-5 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.12)]',
        className
      )}
    />
  );
}

import { type NavCountPath, NAV_COUNT_LABELS, formatNavCount } from '@/lib/nav-counts';

/**
 * What sits after a sidebar page's name when something is waiting there: the number while the
 * column shows names, a dot while it shows only icons. Nothing at zero.
 */
export function NavBadge({
  to,
  count,
  wide,
}: {
  to: NavCountPath;
  count: number | undefined;
  wide: boolean;
}) {
  if (!count) return null;
  const what = NAV_COUNT_LABELS[to];
  return wide ? (
    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1.5 text-[0.6875rem] leading-5 font-medium tabular-nums">
      {formatNavCount(count)}
      <span className="sr-only"> {what}</span>
    </span>
  ) : (
    <span aria-label={`${count} ${what}`} className="bg-brand size-1.5 shrink-0 rounded-full" />
  );
}

/** On a section's icon, when pages inside it have something waiting and are out of sight. */
export function SectionDot() {
  return <span aria-label="Needs a look" className="bg-brand size-1.5 shrink-0 rounded-full" />;
}

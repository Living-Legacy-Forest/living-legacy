/** Pages whose sidebar row shows a number, and what the number counts (for screen readers). */
export const NAV_COUNT_LABELS = {
  '/checks': 'to look at',
  '/redirects': 'missing pages',
} as const;

export type NavCountPath = keyof typeof NAV_COUNT_LABELS;

/** Counts by page; a page is left out when this person cannot act on it. */
export type NavCounts = Partial<Record<NavCountPath, number>>;

/** "99+" past two digits, so a long list never stretches the row. */
export const formatNavCount = (count: number) => (count > 99 ? '99+' : String(count));

/**
 * Whether any page in a section has a count above zero, for the dot on the section's icon when
 * its pages are out of sight.
 */
export function sectionHasCount(pages: readonly { to: string }[], counts: NavCounts) {
  return pages.some((page) => (counts[page.to as NavCountPath] ?? 0) > 0);
}

/** The part of the content checks that counting needs: each check's total. */
type CheckTotals = Record<
  | 'noDescription'
  | 'noImage'
  | 'noAlt'
  | 'events'
  | 'duplicates'
  | 'redirected'
  | 'brand'
  | 'links',
  { total: number }
>;

/** Every open issue across the checks: what the dashboard, the sidebar and the page agree on. */
export function countContentIssues(checks: CheckTotals) {
  return (
    checks.noDescription.total +
    checks.noImage.total +
    checks.noAlt.total +
    checks.events.total +
    checks.duplicates.total +
    checks.redirected.total +
    checks.brand.total +
    checks.links.total
  );
}

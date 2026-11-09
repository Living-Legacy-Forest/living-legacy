/**
 * The page numbers a pager shows: the first and last pages, the current one and
 * its neighbours. null marks a gap (an ellipsis); a gap of a single page shows
 * that page instead, since a number takes no more room than the ellipsis.
 */
export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const kept = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);
  const shown: (number | null)[] = [];
  for (const n of kept) {
    const before = shown.at(-1);
    if (typeof before === 'number' && n - before === 2) shown.push(before + 1);
    else if (typeof before === 'number' && n - before > 2) shown.push(null);
    shown.push(n);
  }
  return shown;
}

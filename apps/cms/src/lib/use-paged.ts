import { useState } from 'react';

/** The page sizes a list on a screen of its own offers; the first is the usual one. */
export const LIST_PAGE_SIZES = [25, 50, 100] as const;

/**
 * Pages a list that is already in memory: which rows are on this page, and
 * the props `<Pager>` needs. Pass a `resetKey` that changes with whatever
 * narrows or reorders the list (search, filters, sort), so a new view starts
 * again from the first page.
 *
 * The page never runs past the last one, so removing the last row on the
 * last page lands on the page before.
 */
export function usePaged<T>(
  rows: readonly T[],
  resetKey = '',
  sizes: readonly number[] = LIST_PAGE_SIZES
) {
  const [asked, setPage] = useState(1);
  const [pageSize, setSize] = useState<number>(sizes[0]!);
  const [seenKey, setSeenKey] = useState(resetKey);
  // Adjusting state while rendering, rather than in an effect, so there is no frame on the old page.
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(asked, pageCount);

  return {
    /** The rows on this page. */
    shown: rows.slice((page - 1) * pageSize, page * pageSize),
    /** False when the list is no longer than the smallest page, so there is nothing to page or choose. */
    needed: rows.length > sizes[0]!,
    /** Spread onto `<Pager>`, with its `noun` and `label`. */
    pager: {
      page,
      pageCount,
      total: rows.length,
      pageSize,
      onPageChange: setPage,
      rows: {
        options: sizes,
        // A new page size starts again from the first page.
        onChange: (next: number) => {
          setSize(next);
          setPage(1);
        },
      },
    },
  };
}

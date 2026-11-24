/**
 * Splits a list into pieces of at most `size`. D1 takes about 100 bound values a query, and every
 * id in an `IN (…)` or every column of an inserted row is one, so long lists go a few at a time.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const pieces: T[][] = [];
  for (let i = 0; i < items.length; i += size) pieces.push(items.slice(i, i + size));
  return pieces;
}

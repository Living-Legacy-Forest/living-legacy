/**
 * Placeholder numbers (30 days, oldest first) for a list's trend chart, until it reads real ones
 * (posts: `getPostViews` in `server/post-views.ts`). Seeded by text so a row keeps its shape.
 */
export function dummyTrend(seedText: string, days = 30): number[] {
  let seed = 0;
  for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const base = 4 + next() * 40;
  const trend = (next() - 0.4) * 0.6;
  return Array.from({ length: days }, (_, i) =>
    Math.max(0, Math.round(base * (1 + trend * (i / days)) * (0.5 + next())))
  );
}

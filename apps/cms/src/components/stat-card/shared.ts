import type { LinkProps } from '@tanstack/react-router';
import { formatInteger } from '@/lib/format';
import type { Growth } from '@/lib/media-growth';

export type Trend = {
  /** Each card draws its trend differently, so a row doesn't read as four copies. */
  kind: 'area' | 'bar' | 'line';
  /** Counts per week, oldest first: the events pages. */
  weeks?: number[];
  /** What was counted, for the tooltip and screen readers ("posts published"). */
  counted: string;
  /** Draw the running total, ending at this, instead of each day's or week's count. */
  total?: { value: number; label: string };
  /** A second, quieter wave behind the first (line charts only), such as readers. */
  compare?: { counted: string; weeks?: number[] };
  /**
   * When the last week ends (now, on the server), to date the weeks: the axis
   * reads "19 Aug … This week" and each tooltip "Week of 3 Nov". Without it
   * the tooltip says "3 weeks ago" and there is no axis.
   */
  endsAt?: number;
  /**
   * Counts per day, oldest first, ending today: the dashboard's cards, which offer 7, 30 or
   * 90 days (twice the longest, so each span has the one before it to compare with).
   */
  days?: {
    /** "2026-11-14", one per count. */
    keys: string[];
    counts: number[];
    compare?: number[];
    /** The span's total is the card's figure, rather than the one in `Stat.value`. */
    headline?: boolean;
  };
};

/** The spans a card with daily counts can show, in days. */
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

/** A usage meter in place of a chart: what takes the space, against an allowance. */
export type Meter = {
  label: string;
  /** In `unit`s, in display order. */
  segments: { id: string; label: string; value: number }[];
  limit: number;
  unit: string;
  decimals?: number;
  freeLabel?: string;
  overLabel?: string;
};

export type Part = { key: string; label: string; value: number; color: string };

export type Stat = {
  label: string;
  value: number;
  /** In place of the plain number, such as "64%". */
  display?: string;
  hint: string;
  trend?: Trend;
  /** Instead of a trend: what the figure is made of, measured against an allowance. */
  meter?: Meter;
  /** With a meter: what was added per day, so the card can say what the span brought in. */
  growth?: Growth;
  /** Parts of the value, drawn as a donut. */
  parts?: Part[];
  /** Where the figure leads: the list behind the number. */
  link?: LinkProps;
};

export const MUTED = 'color-mix(in oklch, var(--muted-foreground) 35%, transparent)';

export const sum = (values: number[]) => values.reduce((total, n) => total + n, 0);

/** The last `span` periods against the `span` before, as "+2"; null when nothing changed. */
export function change(counts: number[], span = 4) {
  const diff = sum(counts.slice(-span)) - sum(counts.slice(-2 * span, -span));
  if (diff === 0) return null;
  return { diff, text: `${diff > 0 ? '+' : '\u2212'}${formatInteger(Math.abs(diff))}` };
}

const WEEK_MS = 7 * 86_400_000;

/** "3 Nov", in the site's time zone. */
export const dayMonth = (timestamp: number, timeZone: string) =>
  new Date(timestamp).toLocaleDateString('en-AU', { timeZone, day: 'numeric', month: 'short' });

/** When week `i` (oldest first) starts: the weeks are the seven-day spans up to `endsAt`. */
export const weekStart = (i: number, count: number, endsAt: number) =>
  endsAt - (count - i) * WEEK_MS;

/**
 * What a week is called in the tooltip: "Week of 3 Nov", or "This week" for the
 * last. Without `endsAt` to date them, "3 weeks ago".
 */
export function weekName(i: number, count: number, endsAt: number | undefined, timeZone: string) {
  const ago = count - 1 - i;
  if (ago === 0) return 'This week';
  if (endsAt === undefined) return ago === 1 ? 'Last week' : `${ago} weeks ago`;
  return `Week of ${dayMonth(weekStart(i, count, endsAt), timeZone)}`;
}

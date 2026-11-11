import { formatInteger } from '@/lib/format';

export type Trend = {
  /** Each card draws its trend differently, so a row doesn't read as four copies. */
  kind: 'area' | 'bar' | 'line';
  /** Counts per week, oldest first. */
  weeks: number[];
  /** What was counted, for the tooltip and screen readers ("posts published"). */
  counted: string;
  /** Draw the running total, ending at this, instead of each week's count. */
  total?: { value: number; label: string };
};

export type Part = { key: string; label: string; value: number; color: string };

export type Stat = {
  label: string;
  value: number;
  /** In place of the plain number, such as "64%". */
  display?: string;
  hint: string;
  trend?: Trend;
  /** Parts of the value, drawn as a donut. */
  parts?: Part[];
};

export const MUTED = 'color-mix(in oklch, var(--muted-foreground) 35%, transparent)';

export const sum = (values: number[]) => values.reduce((total, n) => total + n, 0);

/** The last four weeks against the four before, as "+2"; null when nothing changed. */
export function change(weeks: number[]) {
  const diff = sum(weeks.slice(-4)) - sum(weeks.slice(-8, -4));
  if (diff === 0) return null;
  return { diff, text: `${diff > 0 ? '+' : '\u2212'}${formatInteger(Math.abs(diff))}` };
}

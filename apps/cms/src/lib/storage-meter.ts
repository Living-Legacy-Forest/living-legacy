import type { Meter } from '@/components/stat-card/shared';

/**
 * What the media library is measured against. R2 includes 10 GB a month and bills beyond it,
 * so this is the free allowance rather than a hard limit.
 */
export const MEDIA_ALLOWANCE_BYTES = 10 * 1024 ** 3;

const MEGABYTE = 1024 ** 2;
const GIGABYTE = 1024 ** 3;

const KIND_LABEL = { image: 'Images', video: 'Videos', pdf: 'PDFs', other: 'Other files' } as const;
export type StoredKind = keyof typeof KIND_LABEL;

/** MB, or GB once what is used passes half of one: the numbers stay short and still move. */
function unitFor(usedBytes: number) {
  const big = usedBytes >= GIGABYTE / 2;
  return { size: big ? GIGABYTE : MEGABYTE, unit: big ? 'GB' : 'MB', decimals: big ? 2 : 1 };
}

/**
 * An amount in `size`-byte units, written in GB from one GB up and in MB below, so the
 * allowance and what is left read "10 GB" and "9.99 GB" rather than "10240 MB".
 */
function amountIn(size: number) {
  return (value: number) => {
    const bytes = value * size;
    return bytes >= GIGABYTE
      ? `${(bytes / GIGABYTE).toFixed(2).replace(/\.?0+$/, '')} GB`
      : `${(bytes / MEGABYTE).toFixed(1).replace(/\.0$/, '')} MB`;
  };
}

/** The media library by kind, against the free allowance. */
export function libraryMeter(
  kinds: { kind: StoredKind; bytes: number }[],
  allowanceBytes: number
): Meter {
  const { size, unit, decimals } = unitFor(kinds.reduce((n, k) => n + k.bytes, 0));
  return {
    label: 'Library storage',
    unit,
    decimals,
    limit: allowanceBytes / size,
    formatAmount: amountIn(size),
    freeLabel: 'Left',
    overLabel: 'Over allowance',
    segments: kinds
      .filter((k) => k.bytes > 0)
      .map((k) => ({ id: k.kind, label: KIND_LABEL[k.kind], value: k.bytes / size })),
  };
}

/** The database against the storage its plan includes (more is billed, not refused). */
export function databaseMeter(usedBytes: number, limitBytes: number): Meter {
  const { size, unit, decimals } = unitFor(usedBytes);
  return {
    label: 'Database',
    unit,
    decimals,
    limit: limitBytes / size,
    formatAmount: amountIn(size),
    freeLabel: 'Left',
    overLabel: 'Over allowance',
    segments: [{ id: 'database', label: 'Database', value: usedBytes / size }],
  };
}

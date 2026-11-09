/** Text colours for good, middling and bad, in light and dark. */
export const tone = {
  good: 'text-emerald-700 dark:text-emerald-400',
  mid: 'text-amber-700 dark:text-amber-400',
  bad: 'text-destructive',
} as const;

export const bandTone = { high: tone.good, mid: tone.mid, low: tone.bad } as const;

export const bandStroke = {
  high: 'stroke-emerald-600 dark:stroke-emerald-400',
  mid: 'stroke-amber-500',
  low: 'stroke-destructive',
} as const;

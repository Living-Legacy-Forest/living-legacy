/** Text colours for good, middling and bad, in light and dark. */
export const tone = {
  good: 'text-success-text',
  mid: 'text-warning-text',
  bad: 'text-destructive',
} as const;

export const bandTone = { high: tone.good, mid: tone.mid, low: tone.bad } as const;

export const bandStroke = {
  high: 'stroke-success',
  mid: 'stroke-warning',
  low: 'stroke-destructive',
} as const;

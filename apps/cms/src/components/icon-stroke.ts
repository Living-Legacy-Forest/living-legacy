/**
 * The line weight of every icon that does not set its own. Hugeicons draw at 1.5, which reads
 * light beside 13px text. An icon that uses it is marked `data-icon-stroke`, and the stylesheet
 * draws it at --icon-stroke-default, which a person's Appearance can change; this is that
 * variable's fallback, and so what the stylesheet (styles.css) repeats.
 */
export const ICON_STROKE = 2;
export const ICON_STROKE_ATTR = { 'data-icon-stroke': '' } as const;

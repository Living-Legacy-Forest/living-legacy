// FAQ tags say where an FAQ appears ("home", "pricing", a location page). The
// CMS stores them in this tidy form so the website can match them exactly.

export const MAX_FAQ_TAGS = 20;

/** "Mornington Green!" → "mornington-green". Empty when nothing usable is left. */
export function toTag(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Tidies a list of tags: normalised, blanks and repeats dropped, order kept. */
export function toTags(values: string[]): string[] {
  return [...new Set(values.map(toTag).filter(Boolean))];
}

/** Reads tags written in one cell or field, separated by commas. */
export function splitTags(value: string): string[] {
  return toTags(value.split(','));
}

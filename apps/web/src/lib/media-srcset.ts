/**
 * Responsive sources for images from the CMS media library. The CMS keeps
 * smaller copies of each upload (`media.variants`) and serves them for `?w=`;
 * uploads from before it did have none, and are served at full size only.
 */

/**
 * A `srcset` listing the copies an image has plus the original, and the
 * smallest copy's URL; both undefined when it has no copies.
 */
export function mediaSources(
  url: string,
  width: number | null | undefined,
  variantsJson: string | null
): { srcset?: string; smallUrl?: string } {
  if (!variantsJson || !width) return {};
  let widths: number[];
  try {
    widths = (JSON.parse(variantsJson) as { width: unknown }[])
      .map((v) => Number(v.width))
      .filter((w) => Number.isInteger(w) && w > 0 && w < width)
      .sort((a, b) => a - b);
  } catch {
    return {};
  }
  if (!widths.length) return {};
  return {
    srcset: [...widths.map((w) => `${url}?w=${w} ${w}w`), `${url} ${width}w`].join(', '),
    smallUrl: `${url}?w=${widths[0]}`,
  };
}

// How wide each layout shows its images, for the browser to pick a copy.
// Pages sit in a 1152px column (72rem) with 40px side padding on wider screens.

/** Cards in the two- and three-column grids (blog, media coverage). */
export const CARD_SIZES = '(min-width: 1024px) 340px, (min-width: 640px) 50vw, 100vw';
/** The featured post beside its text on the blog index. */
export const FEATURE_SIZES = '(min-width: 1152px) 536px, (min-width: 768px) 50vw, 100vw';
/** The full-width image at the top of a post. */
export const HERO_SIZES = '(min-width: 1152px) 1072px, 100vw';

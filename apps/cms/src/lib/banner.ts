// Profile banners: the wide image across the top of a person's profile. Pure helpers, so they run
// under plain Node tests; the stored files are handled in lib/banners.ts.

/** Banners are cropped wide, like the strip across an X profile. */
export const BANNER_ASPECT = 3;

export const bannerUrl = (key: string) => `/api/banner/${key}`;

/** The storage key behind a banner URL, or null for anything else. */
export function bannerKey(url: string | null | undefined): string | null {
  const match = url?.match(/^\/api\/banner\/(banner-[\w-]+\.[a-z0-9]+)$/);
  return match?.[1] ?? null;
}

/**
 * Whether an <img> has already failed. The profile is rendered on the server, so a file that is
 * gone can answer 404 before React attaches `onError`, and React does not replay that event; the
 * image is checked once it is on the page instead.
 */
export function imageFailed(img: { complete: boolean; naturalWidth: number }): boolean {
  return img.complete && img.naturalWidth === 0;
}

/**
 * How far this person's default gradient turns from the palette's own hue (0 to 40 degrees), so
 * two people on the same palette do not look identical. Stable for a seed, such as a user id.
 */
export function bannerHueShift(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 41;
}

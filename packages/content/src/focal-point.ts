// A focal point is the part of an image to keep in view when it is cropped, as 0 to 1 across and
// down (set on a file's page in the CMS). Shared so the CMS preview and the website agree.

/**
 * The CSS `object-position` for a focal point ("25% 75%"), or undefined when there is none or only
 * half of one, so the image stays centred as it always was. Values outside 0 to 1 are held to it.
 */
export function focalPosition(
  x: number | null | undefined,
  y: number | null | undefined
): string | undefined {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return undefined;
  }
  const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;
  return `${pct(x)} ${pct(y)}`;
}

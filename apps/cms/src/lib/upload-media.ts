import { mediaVariantWidths } from '@ll/db/enums';
import type { MediaItem } from '@/server/media';
import { makeSizes, prepareImage } from './prepare-image';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';

/** Width and height, so the website can reserve the image's space. */
async function measure(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * An image's address at a given width, for previews in the CMS. The version
 * changes when the file is replaced, so the browser fetches the new one rather
 * than showing the copy it kept. Never stored: posts keep the plain URL.
 */
export function mediaSrc(item: Pick<MediaItem, 'url' | 'version'>, width: number): string {
  return `${item.url}?w=${width}&v=${item.version}`;
}

/**
 * Uploads one image to the Media library and returns it. Images larger than
 * the website ever shows are scaled down first (see prepare-image.ts). With
 * `replace`, the file goes behind that existing image instead, keeping its id.
 */
export async function uploadMedia(original: File, replace?: string): Promise<MediaItem> {
  const file = await prepareImage(original);
  const form = new FormData();
  form.set('file', file);
  const size = await measure(file);
  if (size) {
    form.set('width', String(size.width));
    form.set('height', String(size.height));
  }
  // Best effort: without them the website loads the full-size image instead.
  const sizes = await makeSizes(file, mediaVariantWidths).catch(() => []);
  for (const s of sizes) form.set(`size-${s.width}`, s.file);
  if (replace) form.set('replace', replace);
  const res = await fetch('/api/media', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as (MediaItem & { error?: string }) | null;
  if (!res.ok || !body?.id) throw new Error(body?.error ?? 'Upload failed.');
  return body;
}

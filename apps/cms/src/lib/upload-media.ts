import { DOCUMENT_ACCEPT, documentTypeFor } from '@ll/content';
import { mediaVariantWidths } from '@ll/db/enums';
import type { MediaItem } from '@/server/media';
import { makeSizes, prepareImage } from './prepare-image';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
/** Everything the library takes: images, and PDF and Office documents. */
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}`;

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

/** Sends the form, reporting how much of it has gone, as 0 to 1. */
function send(
  form: FormData,
  onSent?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; body: (MediaItem & { error?: string }) | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media');
    xhr.responseType = 'json';
    if (onSent)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onSent(event.loaded / event.total);
      };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: xhr.response });
    xhr.onerror = () => reject(new Error('The connection dropped. Check it and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/**
 * Uploads one image or document to the Media library and returns it. Images larger than
 * the website ever shows are scaled down first (see prepare-image.ts). With
 * `replace`, the file goes behind that existing image instead, keeping its id.
 * `onProgress` hears 0 to 100: preparing the image is the first third, sending
 * it the rest.
 */
export async function uploadMedia(
  original: File,
  replace?: string,
  options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {}
): Promise<MediaItem> {
  const { onProgress, signal } = options;
  onProgress?.(5);
  // A document goes up as it is: nothing to scale, measure or make smaller copies of.
  if (documentTypeFor(original.name, original.type)) {
    const form = new FormData();
    form.set('file', original);
    if (replace) form.set('replace', replace);
    signal?.throwIfAborted();
    const { ok, body } = await send(
      form,
      onProgress && ((sent) => onProgress(5 + sent * 90)),
      signal
    );
    if (!ok || !body?.id) throw new Error(body?.error ?? 'Upload failed.');
    return body;
  }
  const file = await prepareImage(original);
  const form = new FormData();
  form.set('file', file);
  const size = await measure(file);
  if (size) {
    form.set('width', String(size.width));
    form.set('height', String(size.height));
  }
  onProgress?.(15);
  // Best effort: without them the website loads the full-size image instead.
  const sizes = await makeSizes(file, mediaVariantWidths).catch(() => []);
  for (const s of sizes) form.set(`size-${s.width}`, s.file);
  if (replace) form.set('replace', replace);
  signal?.throwIfAborted();
  onProgress?.(33);
  const { ok, body } = await send(
    form,
    onProgress && ((sent) => onProgress(33 + sent * 62)),
    signal
  );
  if (!ok || !body?.id) throw new Error(body?.error ?? 'Upload failed.');
  return body;
}

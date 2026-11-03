import type { MediaItem } from '@/server/media';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

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

/** Uploads one image to the Media library and returns it. */
export async function uploadMedia(file: File): Promise<MediaItem> {
  const form = new FormData();
  form.set('file', file);
  const size = await measure(file);
  if (size) {
    form.set('width', String(size.width));
    form.set('height', String(size.height));
  }
  const res = await fetch('/api/media', { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as (MediaItem & { error?: string }) | null;
  if (!res.ok || !body?.id) throw new Error(body?.error ?? 'Upload failed.');
  return body;
}

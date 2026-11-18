import { formatBytes } from '@/lib/format';
import { notify } from '@/lib/notify';
import type { CSSProperties } from 'react';
import type { MediaItem } from '@/server/media';

/** `object-position` for an image shown cropped, so its focal point stays in view. */
export function focalStyle(item: Pick<MediaItem, 'focal'>): CSSProperties | undefined {
  return item.focal
    ? { objectPosition: `${Math.round(item.focal.x * 100)}% ${Math.round(item.focal.y * 100)}%` }
    : undefined;
}

/** The file's type as it is usually written on a badge: WEBP, JPG, PDF, DOCX. */
export function extensionLabel(item: Pick<MediaItem, 'filename'>): string {
  return item.filename.split('.').pop()?.slice(0, 5).toUpperCase() ?? '';
}

/** The file's full address, for pasting into an email or another site. */
export async function copyLink(item: MediaItem) {
  try {
    await navigator.clipboard.writeText(new URL(item.url, window.location.origin).href);
    notify.success({ title: 'Link copied', description: `${item.filename} is ready to paste.` });
  } catch {
    notify.error('Could not copy the link', 'Open the file and copy its address instead.');
  }
}

/** Saves the original file under its own name. */
export function download(item: MediaItem) {
  const link = document.createElement('a');
  link.href = item.url;
  link.download = item.filename;
  link.click();
}

/** Size and dimensions, under the file name. */
export function fileFacts(item: MediaItem) {
  return `${formatBytes(item.size)}${item.width && item.height ? ` · ${item.width}×${item.height}` : ''}`;
}

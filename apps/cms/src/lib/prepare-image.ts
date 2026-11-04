// Images are cropped and scaled in the browser before upload: phone photos
// are often 4000px or more, far beyond what the website ever shows, and a crop
// chosen here is the one the site serves.

/** The longest side kept; larger images are scaled down to it. */
const MAX_IMAGE_SIDE = 2560;

/** A crop in the source image's own pixels. */
export type PixelArea = { x: number; y: number; width: number; height: number };

/** GIFs may be animated, and redrawing one keeps only its first frame. */
export const canCrop = (file: { type: string }) => file.type !== 'image/gif';

const QUALITY = 0.86;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * The image cropped to `area` (if given) and scaled so its longest side is at
 * most MAX_IMAGE_SIDE, as WebP where the browser can write it. An image that
 * needs neither is returned untouched, so it is not compressed twice.
 */
export async function prepareImage(file: File, area?: PixelArea): Promise<File> {
  if (!canCrop(file)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Not something the browser can draw; let the server judge it.
    return file;
  }
  const region = area ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(region.width, region.height));
  if (!area && scale === 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  bitmap.close();
  return encode(canvas, file);
}

/**
 * Smaller copies of an already prepared image, one per width it is wider
 * than, for the website to load where it shows the image small.
 */
export async function makeSizes(
  file: File,
  widths: readonly number[]
): Promise<{ width: number; file: File }[]> {
  if (!canCrop(file)) return [];
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return [];
  }
  const sizes: { width: number; file: File }[] = [];
  try {
    for (const width of widths) {
      if (width >= bitmap.width) continue;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      sizes.push({ width, file: await encode(canvas, file) });
    }
  } finally {
    bitmap.close();
  }
  return sizes;
}

async function encode(canvas: HTMLCanvasElement, source: File): Promise<File> {
  // Safari cannot write WebP and hands back a PNG instead; JPEG is far smaller
  // for photos there, and PNG is kept only for a PNG, which may be transparent.
  let blob = await toBlob(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, source.type === 'image/png' ? 'image/png' : 'image/jpeg');
  }
  if (!blob) throw new Error('Could not process this image.');

  const ext = blob.type.split('/')[1]!.replace('jpeg', 'jpg');
  const name = `${source.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`;
  return new File([blob], name, { type: blob.type });
}

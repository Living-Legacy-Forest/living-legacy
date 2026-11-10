/**
 * Checking and storing an uploaded image, shared by a new upload and by
 * replacing the file behind an existing one. Kept out of the route so the
 * integration tests can run it against local R2 and D1.
 */
import { imageExtension, imageSize } from '@ll/content';
import { type MediaVariant, maxImageSide, mediaVariantWidths } from '@ll/db/enums';
import { media } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import type { Db } from '@ll/db';
import { logActivity } from './activity-log';
import { forgetCachedMedia } from './media-delivery';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

/** An image now in R2, with what its media row needs. */
export type StoredUpload = {
  r2Key: string;
  /** Every object written, original first, so a failed save can remove them. */
  keys: string[];
  filename: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  variants: MediaVariant[] | null;
};

/** A reason the upload was refused, for the response. */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

/**
 * Checks the `file` in an upload form and writes it and its smaller copies to
 * R2 under fresh keys. Throws UploadError for anything the person can fix.
 */
export async function storeUpload(form: FormData): Promise<StoredUpload> {
  const file = form.get('file');
  if (!(file instanceof File)) throw new UploadError('No file was uploaded.');
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError('Only JPEG, PNG, WebP, AVIF and GIF images are supported.');
  }
  if (file.size > MAX_BYTES) throw new UploadError('That file is larger than 10 MB.');

  // Sizes come from the file itself: the browser scales large images
  // down, but anything that skips that (an old tab, a script) must not
  // store a 6000px original for the website to serve.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const measured = imageSize(bytes);
  if (!measured) throw new UploadError('That image could not be read.');
  if (Math.max(measured.width, measured.height) > maxImageSide) {
    throw new UploadError(`Images can be at most ${maxImageSide} pixels on the longest side.`);
  }
  // The browser's reading wins when it is the same size turned: a JPEG's
  // header ignores the EXIF rotation the browser applies.
  const dimension = (key: string) => {
    const n = Number(form.get(key));
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const reported = { width: dimension('width'), height: dimension('height') };
  const { width, height } =
    (reported.width === measured.width && reported.height === measured.height) ||
    (reported.width === measured.height && reported.height === measured.width)
      ? (reported as { width: number; height: number })
      : measured;

  const base = crypto.randomUUID();
  // Under media/ so these can be told apart from avatars in the bucket. The
  // extension comes from the checked type, never the file's own name.
  const r2Key = `media/${base}.${imageExtension(file.type)}`;

  // Smaller copies made in the browser. One that is not actually smaller
  // than the original, or not the width it claims, is dropped.
  const sizes: { variant: MediaVariant; bytes: Uint8Array }[] = [];
  for (const w of mediaVariantWidths) {
    const copy = form.get(`size-${w}`);
    if (!(copy instanceof File) || !ALLOWED_MIME.has(copy.type)) continue;
    if (copy.type === 'image/gif' || copy.size >= file.size || w >= width) continue;
    const copyBytes = new Uint8Array(await copy.arrayBuffer());
    if (imageSize(copyBytes)?.width !== w) continue;
    const key = `media/${base}-w${w}.${imageExtension(copy.type)}`;
    sizes.push({ variant: { width: w, key, mime: copy.type }, bytes: copyBytes });
  }

  const keys = [r2Key, ...sizes.map((s) => s.variant.key)];
  try {
    await Promise.all([
      env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: file.type } }),
      ...sizes.map((s) =>
        env.MEDIA.put(s.variant.key, s.bytes, { httpMetadata: { contentType: s.variant.mime } })
      ),
    ]);
  } catch (error) {
    await env.MEDIA.delete(keys).catch(() => {});
    throw error;
  }

  return {
    r2Key,
    keys,
    filename: file.name || r2Key,
    mime: file.type,
    size: file.size,
    width,
    height,
    variants: sizes.length ? sizes.map((s) => s.variant) : null,
  };
}

/**
 * Points an existing media row at a newly stored file. The id, and so every
 * URL using it, stays the same, as do the alt text and caption. The old files
 * are removed afterwards; the daily sweep clears any this misses.
 */
export async function replaceMediaFile(
  db: Db,
  {
    id,
    stored,
    actor,
    origin,
  }: {
    id: string;
    stored: StoredUpload;
    actor: { id: string; name: string };
    origin: string;
  }
) {
  const row = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!row) {
    await env.MEDIA.delete(stored.keys).catch(() => {});
    throw new UploadError('That image is no longer in the media library.', 404);
  }

  try {
    await db.batch([
      db
        .update(media)
        .set({
          r2Key: stored.r2Key,
          filename: stored.filename,
          mime: stored.mime,
          size: stored.size,
          width: stored.width,
          height: stored.height,
          variants: stored.variants,
          updatedAt: new Date(),
        })
        .where(eq(media.id, id)),
      logActivity(db, {
        actorId: actor.id,
        actorName: actor.name,
        action: 'media.replaced',
        summary: `Replaced the file for ${row.filename} with ${stored.filename}`,
      }),
    ]);
  } catch (error) {
    await env.MEDIA.delete(stored.keys).catch(() => {});
    throw error;
  }

  const oldKeys = [row.r2Key, ...(row.variants ?? []).map((v) => v.key)];
  await env.MEDIA.delete(oldKeys).catch((error: unknown) => {
    console.error('[media] could not remove the replaced files', error);
  });
  await forgetCachedMedia(origin, [id]);

  const updated = await db.query.media.findFirst({ where: eq(media.id, id) });
  return updated!;
}

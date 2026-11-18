/**
 * Checking and storing an uploaded image, shared by a new upload and by
 * replacing the file behind an existing one. Kept out of the route so the
 * integration tests can run it against local R2 and D1.
 */
import {
  DOCUMENT_NOTE,
  MAX_DOCUMENT_BYTES,
  documentTypeFor,
  imageExtension,
  imageSize,
  isDocumentMime,
  matchesSignature,
} from '@ll/content';
import { type MediaVariant, maxImageSide, mediaVariantWidths } from '@ll/db/enums';
import { media, mediaVersions } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@ll/db';
import { logActivity } from './activity-log';
import { forgetCachedMedia } from './media-delivery';

/** Earlier files kept per entry for undoing a replace; older ones are removed. */
const MAX_VERSIONS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
/** A PDF's thumbnail is a 640px JPEG, usually well under 200 KB. */
const MAX_COVER_BYTES = 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

/** A file now in R2, with what its media row needs. A document has no size in pixels or copies. */
export type StoredUpload = {
  r2Key: string;
  /** Every object written, original first, so a failed save can remove them. */
  keys: string[];
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
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
 * A PDF or Office file. Its type comes from the name and its first bytes must be that format's,
 * so something renamed to .pdf is refused. Nothing is converted or resized.
 */
async function storeDocument(file: File, cover: FormDataEntryValue | null): Promise<StoredUpload> {
  const type = documentTypeFor(file.name, file.type)!;
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new UploadError(`That file is larger than ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, type)) {
    throw new UploadError(`That file is not a real ${type.label} document.`);
  }
  const base = crypto.randomUUID();
  const r2Key = `media/${base}.${type.extension}`;

  // A PDF's first page, made in the browser, is its thumbnail. It is stored as the one smaller
  // copy, so `?w=` serves it. Anything that is not a small JPEG is dropped, never an error.
  let thumbnail: { variant: MediaVariant; bytes: Uint8Array } | null = null;
  if (type.extension === 'pdf' && cover instanceof File && cover.type === 'image/jpeg') {
    if (cover.size <= MAX_COVER_BYTES) {
      const coverBytes = new Uint8Array(await cover.arrayBuffer());
      const measured = imageSize(coverBytes);
      if (measured && measured.width <= maxImageSide && measured.height <= maxImageSide * 2) {
        thumbnail = {
          variant: { width: measured.width, key: `media/${base}-cover.jpg`, mime: 'image/jpeg' },
          bytes: coverBytes,
        };
      }
    }
  }

  const keys = [r2Key, ...(thumbnail ? [thumbnail.variant.key] : [])];
  try {
    await Promise.all([
      env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: type.mime } }),
      thumbnail &&
        env.MEDIA.put(thumbnail.variant.key, thumbnail.bytes, {
          httpMetadata: { contentType: 'image/jpeg' },
        }),
    ]);
  } catch (error) {
    await env.MEDIA.delete(keys).catch(() => {});
    throw error;
  }
  return {
    r2Key,
    keys,
    filename: file.name || r2Key,
    mime: type.mime,
    size: file.size,
    width: null,
    height: null,
    variants: thumbnail ? [thumbnail.variant] : null,
  };
}

/**
 * Checks the `file` in an upload form and writes it (and an image's smaller copies) to
 * R2 under fresh keys. Throws UploadError for anything the person can fix.
 */
export async function storeUpload(form: FormData): Promise<StoredUpload> {
  const file = form.get('file');
  if (!(file instanceof File)) throw new UploadError('No file was uploaded.');
  if (documentTypeFor(file.name, file.type)) return storeDocument(file, form.get('cover'));
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError(
      `Only JPEG, PNG, WebP, AVIF and GIF images, or ${DOCUMENT_NOTE} documents, are supported.`
    );
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
 * URL using it, stays the same, as do the alt text and caption. The old file is
 * kept as a version (the last few), so the replace can be undone.
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
    throw new UploadError('That file is no longer in the media library.', 404);
  }
  // An image field would break on a document, and a link to a document on an image.
  if (isDocumentMime(row.mime) !== isDocumentMime(stored.mime)) {
    await env.MEDIA.delete(stored.keys).catch(() => {});
    throw new UploadError(
      isDocumentMime(row.mime)
        ? 'A document can only be replaced with another document.'
        : 'An image can only be replaced with another image.'
    );
  }

  try {
    await db.batch([
      // The file being replaced is kept as a version, so the change can be undone.
      db.insert(mediaVersions).values({
        mediaId: id,
        r2Key: row.r2Key,
        filename: row.filename,
        mime: row.mime,
        size: row.size,
        width: row.width,
        height: row.height,
        variants: row.variants,
        replacedBy: actor.id,
      }),
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

  await pruneVersions(db, id);
  await forgetCachedMedia(origin, [id]);

  const updated = await db.query.media.findFirst({ where: eq(media.id, id) });
  return updated!;
}

/** Removes versions beyond the last few, files first so a failed delete is retried next time. */
async function pruneVersions(db: Db, mediaId: string) {
  const versions = await db
    .select({ id: mediaVersions.id, r2Key: mediaVersions.r2Key, variants: mediaVersions.variants })
    .from(mediaVersions)
    .where(eq(mediaVersions.mediaId, mediaId))
    .orderBy(desc(mediaVersions.createdAt), desc(mediaVersions.id));
  const extra = versions.slice(MAX_VERSIONS);
  if (!extra.length) return;
  try {
    await env.MEDIA.delete(
      extra.flatMap((v) => [v.r2Key, ...(v.variants ?? []).map((x) => x.key)])
    );
    await db.delete(mediaVersions).where(
      inArray(
        mediaVersions.id,
        extra.map((v) => v.id)
      )
    );
  } catch (error) {
    console.error('[media] could not remove old versions', error);
  }
}

/**
 * Makes an earlier version the current file again. The file it replaces becomes a version in
 * turn, so restoring can itself be undone. The id and URL stay the same.
 */
export async function restoreMediaVersion(
  db: Db,
  {
    mediaId,
    versionId,
    actor,
    origin,
  }: {
    mediaId: string;
    versionId: string;
    actor: { id: string; name: string };
    origin: string;
  }
) {
  const [row, version] = await Promise.all([
    db.query.media.findFirst({ where: eq(media.id, mediaId) }),
    db.query.mediaVersions.findFirst({
      where: and(eq(mediaVersions.id, versionId), eq(mediaVersions.mediaId, mediaId)),
    }),
  ]);
  if (!row || !version) throw new UploadError('That version is no longer available.', 404);

  await db.batch([
    db.insert(mediaVersions).values({
      mediaId,
      r2Key: row.r2Key,
      filename: row.filename,
      mime: row.mime,
      size: row.size,
      width: row.width,
      height: row.height,
      variants: row.variants,
      replacedBy: actor.id,
    }),
    db
      .update(media)
      .set({
        r2Key: version.r2Key,
        filename: version.filename,
        mime: version.mime,
        size: version.size,
        width: version.width,
        height: version.height,
        variants: version.variants,
        updatedAt: new Date(),
      })
      .where(eq(media.id, mediaId)),
    db.delete(mediaVersions).where(eq(mediaVersions.id, versionId)),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'media.restored',
      summary: `Restored ${version.filename} as the file for ${row.filename}`,
    }),
  ]);
  await forgetCachedMedia(origin, [mediaId]);
}

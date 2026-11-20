import type Anthropic from '@anthropic-ai/sdk';
import type { Db } from '@ll/db';
import { media } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { SuggestError } from './run';

/** What the model reads as an image. SVGs and documents are not photos. */
const READABLE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
/** Wider than this is shrunk by the model anyway, so the smaller copy is as good and much cheaper. */
const MAX_WIDTH = 1568;
/** The API's limit for one image. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The picture for alt text, read from storage here so the browser only ever sends an id. It prefers
 * a stored smaller copy. The caption comes along as context; the filename never does.
 */
export async function loadAltImage(
  db: Db,
  bucket: R2Bucket,
  mediaId: string
): Promise<{ block: Anthropic.ImageBlockParam; caption: string | null }> {
  const row = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!row) throw new SuggestError('That image is no longer in Media.');
  if (!READABLE.has(row.mime)) {
    throw new SuggestError('Alt text can only be suggested for photos and images.');
  }

  const variant = (row.variants ?? [])
    .filter((v) => v.width <= MAX_WIDTH && READABLE.has(v.mime))
    .sort((a, b) => b.width - a.width)[0];
  const object = await bucket.get(variant?.key ?? row.r2Key);
  if (!object) throw new SuggestError('That image is no longer in Media.');
  if (object.size > MAX_BYTES) {
    throw new SuggestError('This image is too large to describe. Replace it with a smaller copy.');
  }

  const data = Buffer.from(await object.arrayBuffer()).toString('base64');
  return {
    block: {
      type: 'image',
      source: {
        type: 'base64',
        media_type: (variant?.mime ?? row.mime) as
          'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data,
      },
    },
    caption: row.caption?.trim() || null,
  };
}

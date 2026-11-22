import { env } from 'cloudflare:workers';
import { bannerKey } from './banner';

/**
 * Deletes the stored file behind a banner URL, but only one tagged as this person's own: the URL
 * is stored per user, so it could in principle name someone else's object.
 */
export async function deleteOwnBanner(url: string | null | undefined, userId: string) {
  const key = bannerKey(url);
  if (!key) return;
  const object = await env.MEDIA.head(key);
  if (object?.customMetadata?.userId === userId) await env.MEDIA.delete(key);
}

import type { Db } from '@ll/db';
import { user } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { bannerKey } from '@/lib/banner';
import { deleteOwnBanner } from '@/lib/banners';

/**
 * Makes an uploaded file this person's banner. The file must be a banner upload that is theirs:
 * the url comes from the browser, so it is checked against what the upload route stored, not
 * trusted. The old file goes once the new one is saved.
 */
export async function adoptBanner(db: Db, userId: string, current: string | null, url: string) {
  const key = bannerKey(url);
  const object = key ? await env.MEDIA.head(key) : null;
  if (!key || object?.customMetadata?.userId !== userId) {
    throw new Error('That banner could not be used.');
  }
  await db.update(user).set({ banner: url, updatedAt: new Date() }).where(eq(user.id, userId));
  if (current && current !== url) await deleteOwnBanner(current, userId);
}

/** Back to the default gradient: the file is deleted and the column cleared. */
export async function removeBanner(db: Db, userId: string, current: string | null) {
  await deleteOwnBanner(current, userId);
  await db.update(user).set({ banner: null, updatedAt: new Date() }).where(eq(user.id, userId));
}

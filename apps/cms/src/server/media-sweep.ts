import { findOrphans } from '@ll/content';
import { createDb } from '@ll/db';
import { media, mediaVersions, user } from '@ll/db/schema';
import { avatarKey } from '@/lib/avatars';
import { bannerKey } from '@/lib/banner';

/**
 * Deletes stored files that no media row, avatar or banner points at. Uploads and
 * deletes clean up after themselves, but a request that dies part way (or a
 * storage call that fails) can still leave files behind. Run daily by cron.
 */
export async function sweepOrphanedMedia(d1: D1Database, bucket: R2Bucket, now: Date) {
  const db = createDb(d1);
  const [rows, versions, users] = await Promise.all([
    db.select({ r2Key: media.r2Key, variants: media.variants }).from(media),
    db.select({ r2Key: mediaVersions.r2Key, variants: mediaVersions.variants }).from(mediaVersions),
    db.select({ image: user.image, banner: user.banner }).from(user),
  ]);
  const referenced = new Set<string>([
    // Earlier versions are kept on purpose, so their files are not unused.
    ...[...rows, ...versions].flatMap((r) => [r.r2Key, ...(r.variants ?? []).map((v) => v.key)]),
    ...users.flatMap((u) => [avatarKey(u.image) ?? [], bannerKey(u.banner) ?? []].flat()),
  ]);

  const objects: { key: string; uploaded: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    objects.push(...page.objects.map((o) => ({ key: o.key, uploaded: o.uploaded })));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const { orphans, refused } = findOrphans(objects, referenced, now);
  if (refused) {
    console.error(
      `Media sweep stopped: most of the ${objects.length} stored files look unused, which suggests a bad lookup.`
    );
    return { deleted: 0, refused };
  }
  // One delete call takes at most 1000 keys.
  for (let i = 0; i < orphans.length; i += 1000) {
    await bucket.delete(orphans.slice(i, i + 1000));
  }
  if (orphans.length) console.warn(`Media sweep deleted ${orphans.length} unused files.`);
  return { deleted: orphans.length, refused };
}

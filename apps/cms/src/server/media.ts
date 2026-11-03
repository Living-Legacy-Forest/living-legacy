import { media } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

function toItem(r: typeof media.$inferSelect) {
  return {
    id: r.id,
    filename: r.filename,
    mime: r.mime,
    size: r.size,
    width: r.width,
    height: r.height,
    alt: r.alt ?? '',
    caption: r.caption ?? '',
    url: `/api/media/${r.id}`,
    createdAt: r.createdAt.getTime(),
  };
}

export type MediaItem = ReturnType<typeof toItem>;

export const listMedia = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb().select().from(media).orderBy(desc(media.createdAt));
    return rows.map(toItem);
  });

export type MediaListData = Awaited<ReturnType<typeof listMedia>>;

/** The images an editor already points at, for showing them in an image field. */
export const getMediaItems = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(50) }))
  .handler(async ({ data }) => {
    const rows = await getDb().select().from(media).where(inArray(media.id, data.ids));
    return rows.map(toItem);
  });

export const updateMedia = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(
    z.object({
      id: z.string(),
      alt: z.string().trim().max(300).optional(),
      caption: z.string().trim().max(500).optional(),
    })
  )
  .handler(async ({ data }) => {
    // Only what was sent: an image field edits the alt text alone and must
    // not clear a caption set in the Media library.
    const patch: { alt?: string | null; caption?: string | null } = {};
    if (data.alt !== undefined) patch.alt = data.alt || null;
    if (data.caption !== undefined) patch.caption = data.caption || null;
    if (Object.keys(patch).length === 0) return;
    await getDb().update(media).set(patch).where(eq(media.id, data.id));
  });

export const deleteMedia = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({ id: media.id, r2Key: media.r2Key })
      .from(media)
      .where(inArray(media.id, data.ids));
    // Anything using this image (a post, team member, testimonial or media coverage) is set to
    // null by the FK;
    // the R2 object itself has no such guard, so delete it ourselves.
    await Promise.allSettled(rows.map((r) => env.MEDIA.delete(r.r2Key)));
    await db.delete(media).where(inArray(media.id, data.ids));
    return { removed: rows.length };
  });

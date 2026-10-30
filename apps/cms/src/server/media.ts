import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { media } = schema;

export const listMedia = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await getDb().select().from(media).orderBy(desc(media.createdAt));
    return rows.map((r) => ({
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
    }));
  });

export type MediaListData = Awaited<ReturnType<typeof listMedia>>;
export type MediaItem = MediaListData[number];

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
    await getDb()
      .update(media)
      .set({ alt: data.alt || null, caption: data.caption || null })
      .where(eq(media.id, data.id));
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
    // Any post using this as its featured/OG image is set to null by the FK;
    // the R2 object itself has no such guard, so delete it ourselves.
    await Promise.allSettled(rows.map((r) => env.MEDIA.delete(r.r2Key)));
    await db.delete(media).where(inArray(media.id, data.ids));
    return { removed: rows.length };
  });

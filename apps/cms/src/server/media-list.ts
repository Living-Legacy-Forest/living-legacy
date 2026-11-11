// Paging through the media library, newest first: the library page grows a
// page at a time, and the image picker follows a cursor.
import type { Db } from '@ll/db';
import { media } from '@ll/db/schema';
import { type SQL, and, count, desc, eq, like, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { MEDIA_MAX_SHOWN, MEDIA_PAGE_SIZE } from '@/lib/media-paging';

// Newest first, with the id breaking ties so pages never overlap or skip.
const newestFirst = [desc(media.createdAt), desc(media.id)];

/** A position in the list: the last file a page ended on. */
const cursorOf = (r: typeof media.$inferSelect) => `${r.createdAt.getTime()}_${r.id}`;

function afterCursor(cursor: string): SQL | undefined {
  const [ms, id] = [cursor.slice(0, cursor.indexOf('_')), cursor.slice(cursor.indexOf('_') + 1)];
  const at = new Date(Number(ms));
  if (!id || Number.isNaN(at.getTime())) return undefined;
  return or(lt(media.createdAt, at), and(eq(media.createdAt, at), lt(media.id, id)));
}

/** Every word must appear in the file name, alt text or caption (any case). */
function searchWhere(q: string | undefined): SQL | undefined {
  const words = (q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return undefined;
  return and(
    ...words.map((word) => {
      const pattern = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const field = (column: typeof media.filename | typeof media.alt | typeof media.caption) =>
        sql`lower(coalesce(${column}, '')) like ${pattern} escape '\\'`;
      return or(field(media.filename), field(media.alt), field(media.caption));
    })
  );
}

export function toItem(r: typeof media.$inferSelect) {
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
    /** Changes when the file is replaced; added to previews so the CMS shows the new one. */
    version: r.updatedAt.getTime(),
  };
}

export type MediaItem = ReturnType<typeof toItem>;

export const listMediaSchema = z.object({
  q: z.string().max(100).optional(),
  /** Leave out documents, for an image field. */
  imagesOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(MEDIA_MAX_SHOWN).default(MEDIA_PAGE_SIZE),
  /** Continue after this position (`nextCursor` from the page before). */
  cursor: z.string().max(100).optional(),
  /** A file to return as well, even if it is not on this page: one linked to directly. */
  include: z.string().max(100).optional(),
});

export async function listMediaPage(db: Db, data: z.infer<typeof listMediaSchema>) {
  const filter = and(
    searchWhere(data.q),
    data.imagesOnly ? like(media.mime, 'image/%') : undefined
  );
  const where = and(filter, data.cursor ? afterCursor(data.cursor) : undefined);

  // One extra row says whether there is another page.
  const [rows, [total], included] = await Promise.all([
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(...newestFirst)
      .limit(data.limit + 1),
    db.select({ value: count() }).from(media).where(filter),
    data.include
      ? db.query.media.findFirst({ where: eq(media.id, data.include) })
      : Promise.resolve(undefined),
  ]);
  const page = rows.slice(0, data.limit);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    total: total?.value ?? 0,
    nextCursor: rows.length > data.limit && last ? cursorOf(last) : null,
    included: included && !page.some((r) => r.id === included.id) ? toItem(included) : null,
  };
}

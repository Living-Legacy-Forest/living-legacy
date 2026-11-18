// Paging through the media library, newest first: the library page grows a
// page at a time, and the image picker follows a cursor.
import type { Db } from '@ll/db';
import { DOCUMENT_TYPES, type MediaSort, isDocumentMime, mediaSorts } from '@ll/content';
import { media } from '@ll/db/schema';
import { type SQL, and, asc, count, desc, eq, inArray, like, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { MEDIA_MAX_SHOWN, MEDIA_PAGE_SIZE } from '@/lib/media-paging';

/**
 * A file's extension from its name, lower case: what follows the last dot, or nothing when there
 * is none. (SQLite has no "last index of", so the name is cut at the last dot by removing the
 * longest tail that holds no dot.)
 */
const extensionOf = sql<string>`case when instr(${media.filename}, '.') > 0 then lower(replace(${media.filename}, rtrim(${media.filename}, replace(${media.filename}, '.', '')), '')) else '' end`;

// The id breaks ties so pages never overlap or skip.
const orderFor = (sort: MediaSort) =>
  ({
    newest: [desc(media.createdAt), desc(media.id)],
    oldest: [asc(media.createdAt), asc(media.id)],
    'name-az': [sql`lower(${media.filename}) asc`, asc(media.id)],
    'name-za': [sql`lower(${media.filename}) desc`, desc(media.id)],
    largest: [desc(media.size), desc(media.id)],
    smallest: [asc(media.size), asc(media.id)],
  })[sort];

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
      const field = (
        column: typeof media.filename | typeof media.alt | typeof media.caption | typeof media.tags
      ) => sql`lower(coalesce(${column}, '')) like ${pattern} escape '\\'`;
      return or(field(media.filename), field(media.alt), field(media.caption), field(media.tags));
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
    tags: r.tags ?? [],
    /** Where to keep in view when the image is cropped, 0 to 1 across and down; null is the centre. */
    focal: r.focalX !== null && r.focalY !== null ? { x: r.focalX, y: r.focalY } : null,
    url: `/api/media/${r.id}`,
    /** A document with a thumbnail of its first page (PDFs uploaded since they were made). */
    hasCover: isDocumentMime(r.mime) && !!r.variants?.length,
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
  /** Only images, or only documents, for the library's filter. */
  kind: z.enum(['image', 'document']).optional(),
  /** Files with any of these tags. */
  tags: z.array(z.string().max(40)).max(20).optional(),
  /** Files whose name ends in any of these (lower case, no dot): "pdf", "jpg". */
  exts: z
    .array(z.string().regex(/^[a-z0-9]{1,8}$/))
    .max(20)
    .optional(),
  limit: z.number().int().min(1).max(MEDIA_MAX_SHOWN).default(MEDIA_PAGE_SIZE),
  /** The order. Paging by `cursor` follows newest first, so other orders load by `limit`. */
  sort: z
    .enum(mediaSorts.map((s) => s.value) as [MediaSort, ...MediaSort[]])
    .optional()
    .catch('newest'),
  /** Continue after this position (`nextCursor` from the page before). */
  cursor: z.string().max(100).optional(),
  /** A file to return as well, even if it is not on this page: one linked to directly. */
  include: z.string().max(100).optional(),
});

export async function listMediaPage(db: Db, data: z.infer<typeof listMediaSchema>) {
  const filter = and(
    searchWhere(data.q),
    data.imagesOnly || data.kind === 'image' ? like(media.mime, 'image/%') : undefined,
    data.kind === 'document'
      ? inArray(
          media.mime,
          DOCUMENT_TYPES.map((t) => t.mime)
        )
      : undefined,
    data.tags?.length
      ? sql`exists (select 1 from json_each(coalesce(${media.tags}, '[]')) where value in (${sql.join(
          data.tags.map((t) => sql`${t}`),
          sql`, `
        )}))`
      : undefined,
    data.exts?.length ? inArray(extensionOf, data.exts) : undefined
  );
  const where = and(filter, data.cursor ? afterCursor(data.cursor) : undefined);

  // One extra row says whether there is another page.
  const [rows, [total], included] = await Promise.all([
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(...orderFor(data.cursor ? 'newest' : (data.sort ?? 'newest')))
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

/** Every tag in use with how many files carry it, most used first, for the library's filter. */
export async function listMediaTags(db: Db) {
  const rows = await db.all<{ tag: string; n: number }>(
    sql`select value as tag, count(*) as n from media, json_each(coalesce(media.tags, '[]')) group by value order by n desc, value limit 100`
  );
  return rows.map((r) => ({ tag: r.tag, count: Number(r.n) }));
}

/** Every extension in use with how many files have it, most used first, for the format filter. */
export async function listMediaExtensions(db: Db) {
  const rows = await db
    .select({ ext: extensionOf, n: count() })
    .from(media)
    .groupBy(extensionOf)
    .orderBy(desc(count()));
  return rows.filter((r) => r.ext).map((r) => ({ ext: r.ext, count: r.n }));
}

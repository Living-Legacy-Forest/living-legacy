import {
  events,
  faqs,
  locations,
  media,
  mediaCoverage,
  posts,
  teamMembers,
  testimonials,
} from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { renamedFilename } from '@/lib/filename';
import { forgetCachedMedia } from './media-delivery';

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
    /** Changes when the file is replaced; added to previews so the CMS shows the new one. */
    version: r.updatedAt.getTime(),
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
      /** The new name without its extension, which always stays the original. */
      filename: z.string().max(300).optional(),
    })
  )
  .handler(async ({ data }) => {
    const db = getDb();
    // Only what was sent: an image field edits the alt text alone and must
    // not clear a caption set in the Media library.
    const patch: { alt?: string | null; caption?: string | null; filename?: string } = {};
    if (data.alt !== undefined) patch.alt = data.alt || null;
    if (data.caption !== undefined) patch.caption = data.caption || null;
    if (data.filename !== undefined) {
      const row = await db.query.media.findFirst({ where: eq(media.id, data.id) });
      if (!row) throw new Error('That file is no longer in the media library.');
      patch.filename = renamedFilename(row.filename, data.filename);
    }
    if (Object.keys(patch).length === 0) return;
    await db.update(media).set(patch).where(eq(media.id, data.id));
  });

// Everywhere an image can be used: image fields, rich text (which stores
// `/api/media/:id` paths) and unpublished drafts (which hold either).
const usageSources = [
  {
    kind: 'post',
    table: posts,
    id: posts.id,
    label: posts.title,
    text: [posts.featuredMediaId, posts.ogMediaId, posts.body, posts.draft],
  },
  {
    kind: 'team member',
    table: teamMembers,
    id: teamMembers.id,
    label: teamMembers.name,
    text: [teamMembers.photoMediaId, teamMembers.bio, teamMembers.draft],
  },
  { kind: 'FAQ', table: faqs, id: faqs.id, label: faqs.question, text: [faqs.answer, faqs.draft] },
  {
    kind: 'testimonial',
    table: testimonials,
    id: testimonials.id,
    label: testimonials.name,
    text: [testimonials.photoMediaId, testimonials.draft],
  },
  {
    kind: 'media coverage item',
    table: mediaCoverage,
    id: mediaCoverage.id,
    label: mediaCoverage.title,
    text: [mediaCoverage.imageMediaId, mediaCoverage.draft],
  },
  {
    kind: 'location',
    table: locations,
    id: locations.id,
    label: locations.name,
    text: [locations.heroMediaId, locations.about, locations.draft],
  },
  {
    kind: 'event',
    table: events,
    id: events.id,
    label: events.title,
    text: [events.heroMediaId, events.galleryMediaIds, events.description],
  },
] satisfies {
  kind: string;
  table: SQLiteTable;
  id: SQLiteColumn;
  label: SQLiteColumn;
  text: SQLiteColumn[];
}[];

/** Where each of `ids` is still used, as "post “Title”" labels. */
async function findUsage(db: ReturnType<typeof getDb>, ids: string[]) {
  const found = await Promise.all(
    usageSources.map(async ({ kind, table, id: idColumn, label, text }) => {
      const haystack = sql<string>`(${sql.join(
        text.map((c) => sql`coalesce(${c}, '')`),
        sql` || ' ' || `
      )})`;
      // Media ids are ULIDs, so they hold no LIKE wildcards.
      const rows = await db
        .select({ id: sql<string>`${idColumn}`, label: sql<string>`${label}`, haystack })
        .from(table)
        .where(or(...ids.map((id) => sql`${haystack} like ${`%${id}%`}`)));
      return rows.map((r) => ({
        kind,
        id: r.id,
        label: r.label,
        name: `${kind} “${r.label}”`,
        haystack: r.haystack,
      }));
    })
  );
  return found.flat();
}

/** Where one image is used, for the media panel. Drafts count, as deleting would break them. */
export const getMediaUsage = createServerFn({ method: 'GET' })
  .middleware([requirePermission('media:write')])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(async ({ data }) => {
    const found = await findUsage(getDb(), [data.id]);
    return found.map(({ kind, id, label }) => ({ kind, id, label }));
  });

export type MediaUsage = Awaited<ReturnType<typeof getMediaUsage>>;

// Removing a file is permanent, so it needs content:purge like emptying the
// trash; media:write only uploads and edits.
export const deleteMedia = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:purge')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .handler(async ({ data }) => {
    const db = getDb();

    // Deleting an image still in use would leave a broken image on the site
    // (or a draft that can no longer publish), so it is refused instead.
    const usage = await findUsage(db, data.ids);
    if (usage.length) {
      const inUse = data.ids.filter((id) => usage.some((u) => u.haystack.includes(id)));
      // Each date of a repeating event is its own row, under the one name.
      const places = [...new Set(usage.map((u) => u.name))];
      const where =
        places.length > 3
          ? `${places.slice(0, 3).join(', ')} and ${places.length - 3} more`
          : places.join(', ');
      throw new Error(
        `${inUse.length === 1 ? 'An image' : `${inUse.length} images`} you chose ${
          inUse.length === 1 ? 'is' : 'are'
        } still used in ${where}. Remove ${inUse.length === 1 ? 'it' : 'them'} there first.`
      );
    }

    const rows = await db
      .select({ id: media.id, r2Key: media.r2Key, variants: media.variants })
      .from(media)
      .where(inArray(media.id, data.ids));

    // A row goes only once its files have: otherwise the files would stay
    // stored with nothing pointing at them. Deleting again retries.
    const results = await Promise.allSettled(
      rows.map((r) => env.MEDIA.delete([r.r2Key, ...(r.variants ?? []).map((v) => v.key)]))
    );
    const removed = rows.filter((_, i) => results[i]!.status === 'fulfilled').map((r) => r.id);
    if (removed.length) {
      await db.delete(media).where(inArray(media.id, removed));
      await forgetCachedMedia(new URL(getRequest().url).origin, removed);
    }
    if (removed.length < rows.length) {
      throw new Error(
        `${rows.length - removed.length} of the images could not be deleted. Try again.`
      );
    }
    return { removed: removed.length };
  });

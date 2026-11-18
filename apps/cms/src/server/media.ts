import {
  events,
  faqs,
  locations,
  media,
  mediaCoverage,
  mediaVersions,
  posts,
  teamMembers,
  testimonials,
  user,
} from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { renamedFilename } from '@/lib/filename';
import { forgetCachedMedia } from './media-delivery';
import {
  listMediaExtensions as extensionsOf,
  listMediaPage,
  listMediaSchema,
  listMediaTags as tagsOf,
  toItem,
} from './media-list';
import { restoreMediaVersion } from './media-store';

export type { MediaItem } from './media-list';

/** A page of the library, newest first. */
export const listMedia = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(listMediaSchema)
  .handler(({ data }) => listMediaPage(getDb(), data));

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
      /** Labels for finding the file; lower case, no repeats. */
      tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).optional(),
      /** The part of an image to keep in view when it is cropped; null returns to the centre. */
      focal: z
        .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
        .nullable()
        .optional(),
    })
  )
  .handler(async ({ data }) => {
    const db = getDb();
    // Only what was sent: an image field edits the alt text alone and must
    // not clear a caption set in the Media library.
    const patch: {
      alt?: string | null;
      caption?: string | null;
      filename?: string;
      tags?: string[] | null;
      focalX?: number | null;
      focalY?: number | null;
    } = {};
    if (data.alt !== undefined) patch.alt = data.alt || null;
    if (data.caption !== undefined) patch.caption = data.caption || null;
    if (data.tags !== undefined) {
      const tags = [...new Set(data.tags)];
      patch.tags = tags.length ? tags : null;
    }
    if (data.focal !== undefined) {
      patch.focalX = data.focal ? Math.round(data.focal.x * 1000) / 1000 : null;
      patch.focalY = data.focal ? Math.round(data.focal.y * 1000) / 1000 : null;
    }
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
    // Each date of a repeating event is its own row; list the series once.
    group: events.seriesId,
  },
] satisfies {
  kind: string;
  table: SQLiteTable;
  id: SQLiteColumn;
  label: SQLiteColumn;
  text: SQLiteColumn[];
  group?: SQLiteColumn;
}[];

/** Where each of `ids` is still used, as "post “Title”" labels. */
async function findUsage(db: ReturnType<typeof getDb>, ids: string[]) {
  const found = await Promise.all(
    usageSources.map(async (source) => {
      const { kind, table, id: idColumn, label, text } = source;
      const group = 'group' in source ? source.group : idColumn;
      const haystack = sql<string>`(${sql.join(
        text.map((c) => sql`coalesce(${c}, '')`),
        sql` || ' ' || `
      )})`;
      // Media ids are ULIDs, so they hold no LIKE wildcards.
      const rows = await db
        .select({
          id: sql<string>`${idColumn}`,
          group: sql<string>`coalesce(${group}, ${idColumn})`,
          label: sql<string>`${label}`,
          haystack,
        })
        .from(table)
        .where(or(...ids.map((id) => sql`${haystack} like ${`%${id}%`}`)));
      return rows.map((r) => ({
        kind,
        id: r.id,
        group: r.group,
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
    const uses = new Map<string, { kind: string; id: string; label: string; count: number }>();
    for (const { kind, id, group, label } of found) {
      const key = `${kind}:${group}`;
      const use = uses.get(key);
      if (use) use.count++;
      else uses.set(key, { kind, id, label, count: 1 });
    }
    return [...uses.values()];
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
    // Earlier versions go with the file (their rows follow it), files and all.
    const older = await db
      .select({
        mediaId: mediaVersions.mediaId,
        r2Key: mediaVersions.r2Key,
        variants: mediaVersions.variants,
      })
      .from(mediaVersions)
      .where(inArray(mediaVersions.mediaId, data.ids));
    const keysOf = (id: string) =>
      older
        .filter((v) => v.mediaId === id)
        .flatMap((v) => [v.r2Key, ...(v.variants ?? []).map((x) => x.key)]);

    // A row goes only once its files have: otherwise the files would stay
    // stored with nothing pointing at them. Deleting again retries.
    const results = await Promise.allSettled(
      rows.map((r) =>
        env.MEDIA.delete([r.r2Key, ...(r.variants ?? []).map((v) => v.key), ...keysOf(r.id)])
      )
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

/** Every extension in use with its count, for the library's format filter. */
export const listMediaExtensions = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => extensionsOf(getDb()));

/** Every tag in use with its count, for the library's filter. */
export const listMediaTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => tagsOf(getDb()));

/**
 * One file for its page: the item, who uploaded it, the files either side of it in the library
 * (newest first), and its earlier versions.
 */
export const getMediaDetail = createServerFn({ method: 'GET' })
  .middleware([requirePermission('media:write')])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const row = await db.query.media.findFirst({ where: eq(media.id, data.id) });
    if (!row) return null;

    const [uploader, newer, older, versions] = await Promise.all([
      row.uploadedBy
        ? db.select({ name: user.name }).from(user).where(eq(user.id, row.uploadedBy)).limit(1)
        : Promise.resolve([]),
      // The library lists newest first, so "previous" is the file just above this one.
      db
        .select({ id: media.id })
        .from(media)
        .where(
          or(
            gt(media.createdAt, row.createdAt),
            and(eq(media.createdAt, row.createdAt), gt(media.id, row.id))
          )
        )
        .orderBy(asc(media.createdAt), asc(media.id))
        .limit(1),
      db
        .select({ id: media.id })
        .from(media)
        .where(
          or(
            lt(media.createdAt, row.createdAt),
            and(eq(media.createdAt, row.createdAt), lt(media.id, row.id))
          )
        )
        .orderBy(desc(media.createdAt), desc(media.id))
        .limit(1),
      db
        .select({
          id: mediaVersions.id,
          filename: mediaVersions.filename,
          mime: mediaVersions.mime,
          size: mediaVersions.size,
          width: mediaVersions.width,
          height: mediaVersions.height,
          replacedAt: mediaVersions.createdAt,
          replacedBy: user.name,
        })
        .from(mediaVersions)
        .leftJoin(user, eq(user.id, mediaVersions.replacedBy))
        .where(eq(mediaVersions.mediaId, row.id))
        .orderBy(desc(mediaVersions.createdAt)),
    ]);

    return {
      item: toItem(row),
      uploader: uploader[0]?.name ?? null,
      previousId: newer[0]?.id ?? null,
      nextId: older[0]?.id ?? null,
      versions: versions.map((v) => ({ ...v, replacedAt: v.replacedAt.getTime() })),
    };
  });

export type MediaDetail = NonNullable<Awaited<ReturnType<typeof getMediaDetail>>>;

/** Puts an earlier version back as the current file; the one it replaces becomes a version. */
export const restoreMediaVersionFn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(z.object({ id: z.string().max(64), versionId: z.string().max(64) }))
  .handler(async ({ data, context }) => {
    await restoreMediaVersion(getDb(), {
      mediaId: data.id,
      versionId: data.versionId,
      actor: { id: context.user.id, name: context.user.name },
      origin: new URL(getRequest().url).origin,
    });
  });

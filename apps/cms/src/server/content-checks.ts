import { can } from '@ll/content';
import { events, media, posts } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';

/** More than this many of one problem is a list nobody works through; the count says the rest. */
const SHOWN = 100;

const blank = (column: unknown) => sql`coalesce(trim(${column}), '') = ''`;

/**
 * What visitors and search engines miss, found from the live content:
 * - published posts with nothing to describe them in search results (no SEO
 *   description and no excerpt, which the website falls back to);
 * - published posts with no image when shared (no share image and no
 *   featured image, the fallback);
 * - images in use with no alt text (images placed in rich text carry their
 *   own alt text, so these are the image fields);
 * - upcoming published events with no cover photo or no summary.
 */
export const getContentChecks = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { role } = context.user;
    if (!can(role, 'posts:publish') && !can(role, 'seo:write')) {
      throw new Error('Content checks are for people who publish or look after SEO.');
    }
    const db = getDb();
    const livePost = and(eq(posts.status, 'published'), isNull(posts.deletedAt));

    const [noDescription, noImage, noAlt, eventRows] = await db.batch([
      db
        .select({ id: posts.id, title: posts.title })
        .from(posts)
        .where(and(livePost, blank(posts.seoDescription), blank(posts.excerpt)))
        .orderBy(asc(posts.title)),
      db
        .select({ id: posts.id, title: posts.title })
        .from(posts)
        .where(and(livePost, isNull(posts.ogMediaId), isNull(posts.featuredMediaId)))
        .orderBy(asc(posts.title)),
      // Every image field that points at the library. Deleted rows (in the
      // trash, or soft-deleted) no longer show anywhere, so they do not count.
      db
        .select({ id: media.id, filename: media.filename })
        .from(media)
        .where(
          and(
            blank(media.alt),
            // One EXISTS per table: D1 refuses a UNION chain this long.
            sql`(
              exists (select 1 from posts p where p.deleted_at is null
                and ${media.id} in (p.featured_media_id, p.og_media_id))
              or exists (select 1 from team_members t where t.deleted_at is null
                and t.photo_media_id = ${media.id})
              or exists (select 1 from testimonials t where t.deleted_at is null
                and t.photo_media_id = ${media.id})
              or exists (select 1 from media_coverage c where c.image_media_id = ${media.id})
              or exists (select 1 from locations l where l.deleted_at is null
                and l.hero_media_id = ${media.id})
              or exists (select 1 from events e where e.status != 'cancelled'
                and (e.hero_media_id = ${media.id}
                  or exists (select 1 from json_each(e.gallery_media_ids) g where g.value = ${media.id})))
            )`
          )
        )
        .orderBy(asc(media.filename)),
      db
        .select({
          id: events.id,
          seriesId: events.seriesId,
          title: events.title,
          startsAt: events.startsAt,
          noCover: sql<number>`${events.heroMediaId} is null`,
          noSummary: sql<number>`${blank(events.summary)}`,
        })
        .from(events)
        .where(
          and(
            eq(events.status, 'published'),
            gte(events.endsAt, new Date()),
            sql`(${events.heroMediaId} is null or ${blank(events.summary)})`
          )
        )
        .orderBy(asc(events.startsAt)),
    ]);

    // A repeating event is one row per date: list it once, at its next date.
    const seen = new Set<string>();
    const eventsMissing = eventRows
      .filter((e) => {
        const key = e.seriesId ?? e.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.getTime(),
        noCover: Boolean(e.noCover),
        noSummary: Boolean(e.noSummary),
      }));

    const capped = <T>(rows: T[]) => ({ total: rows.length, rows: rows.slice(0, SHOWN) });
    return {
      noDescription: capped(noDescription),
      noImage: capped(noImage),
      noAlt: capped(noAlt),
      events: capped(eventsMissing),
    };
  });

export type ContentChecks = Awaited<ReturnType<typeof getContentChecks>>;

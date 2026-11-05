import { parseSiteSettings } from '@ll/content';
import { faqs, locations, media, posts, siteSettings } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, count, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';

const DAY_MS = 86_400_000;
const ACTIVITY_DAYS = 90;

export type PostSummary = {
  id: string;
  title: string;
  at: number;
  /** The featured image, for a thumbnail. */
  imageId: string | null;
};

export const getDashboardData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = getDb();
    const now = Date.now();
    const notTrashed = isNull(posts.deletedAt);
    const isPublished = and(eq(posts.status, 'published'), notTrashed);
    const since = (days: number) => new Date(now - days * DAY_MS);

    // One round trip to the database for the settings and every panel.
    const [
      settingsRows,
      postCounts,
      mediaTotals,
      faqCount,
      activityRows,
      locationRows,
      drafts,
      published,
    ] = await db.batch([
      db.select({ data: siteSettings.data }).from(siteSettings).where(eq(siteSettings.id, 'site')),
      db
        .select({
          published: sql<number>`coalesce(sum(${posts.status} = 'published'), 0)`,
          drafts: sql<number>`coalesce(sum(${posts.status} = 'draft'), 0)`,
          last30: sql<number>`coalesce(sum(${posts.status} = 'published' and ${posts.publishedAt} >= ${since(30).getTime()}), 0)`,
          prior30: sql<number>`coalesce(sum(${posts.status} = 'published' and ${posts.publishedAt} >= ${since(60).getTime()} and ${posts.publishedAt} < ${since(30).getTime()}), 0)`,
        })
        .from(posts)
        .where(notTrashed),
      db
        .select({
          files: count(),
          bytes: sum(media.size),
          missingAlt: sql<number>`coalesce(sum(${media.alt} is null or trim(${media.alt}) = ''), 0)`,
        })
        .from(media),
      db
        .select({ total: count() })
        .from(faqs)
        .where(and(eq(faqs.status, 'published'), isNull(faqs.deletedAt))),
      db
        .select({ publishedAt: posts.publishedAt })
        .from(posts)
        .where(and(isPublished, gte(posts.publishedAt, since(ACTIVITY_DAYS)))),
      db
        .select({
          id: locations.id,
          name: locations.name,
          stage: locations.stage,
          latitude: locations.latitude,
          longitude: locations.longitude,
          heroMediaId: locations.heroMediaId,
        })
        .from(locations)
        .where(isNull(locations.deletedAt))
        .orderBy(asc(locations.sortOrder), asc(locations.name)),
      db
        .select({
          id: posts.id,
          title: posts.title,
          at: posts.updatedAt,
          imageId: posts.featuredMediaId,
        })
        .from(posts)
        .where(and(eq(posts.status, 'draft'), notTrashed))
        .orderBy(desc(posts.updatedAt))
        .limit(5),
      db
        .select({
          id: posts.id,
          title: posts.title,
          at: posts.publishedAt,
          imageId: posts.featuredMediaId,
        })
        .from(posts)
        .where(isPublished)
        .orderBy(desc(posts.publishedAt))
        .limit(5),
    ]);

    // Days are bucketed in the organisation's configured timezone, not UTC.
    const { timeZone } = parseSiteSettings(settingsRows[0]?.data);
    const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone });

    // One row per day, oldest first, including days with nothing published.
    const perDay = new Map<string, number>();
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) perDay.set(dayKey(since(i)), 0);
    for (const { publishedAt } of activityRows) {
      if (!publishedAt) continue;
      const key = dayKey(publishedAt);
      if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }

    const counts = postCounts[0];
    const toSummary = (row: {
      id: string;
      title: string;
      at: Date | null;
      imageId: string | null;
    }): PostSummary => ({
      id: row.id,
      title: row.title,
      at: row.at?.getTime() ?? 0,
      imageId: row.imageId,
    });

    return {
      posts: {
        published: Number(counts?.published ?? 0),
        drafts: Number(counts?.drafts ?? 0),
        publishedLast30: Number(counts?.last30 ?? 0),
        publishedPrior30: Number(counts?.prior30 ?? 0),
      },
      media: {
        files: mediaTotals[0]?.files ?? 0,
        bytes: Number(mediaTotals[0]?.bytes ?? 0),
        missingAlt: Number(mediaTotals[0]?.missingAlt ?? 0),
      },
      publishedFaqs: faqCount[0]?.total ?? 0,
      activity: [...perDay].map(([date, published]) => ({ date, published })),
      locations: locationRows,
      recentDrafts: drafts.map(toSummary),
      recentlyPublished: published.map(toSummary),
    };
  });

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

import { type Access, can } from '@ll/content';
import { eventBookings, events, locations, media, posts } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt, sql, sum } from 'drizzle-orm';
import { bucketByDay, dayKey, dayKeys } from '@/lib/dashboard-trend';
import { getDb } from '@/lib/db';
import { growthOf } from '@/lib/media-growth';
import { MEDIA_ALLOWANCE_BYTES } from '@/lib/storage-meter';
import { readSiteSettings } from '@/lib/site-settings';
import { authMiddleware } from '@/lib/session';
import { loadContentChecks } from './content-checks';
import { loadMissingPages } from './not-found';
import { loadScoreSummary } from './post-score';
import { hasAnalytics } from './dashboard-trend-store';
import { healthOptions, runHealthChecks } from './system-health';
import { fileKind, loadJobHealth } from './system-store';

const DAY_MS = 86_400_000;
/** How many days the stat cards' charts hold: the longest span they offer, and the one before it. */
export const TREND_DAYS = 180;

export type PostSummary = {
  id: string;
  title: string;
  at: number;
  /** The featured image, for a thumbnail. */
  imageId: string | null;
};

export const getDashboardData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = getDb();
    const now = Date.now();
    const attention = loadAttention(db, context.user, now);
    // Scores are for the people who can act on them, like the content checks.
    const { user } = context;
    const scores =
      can(user, 'posts:publish') || can(user, 'seo:write') ? loadScoreSummary(db) : null;
    // The cards' counts per calendar day in the site's zone, ending today.
    const { timeZone } = await readSiteSettings();
    const dayList = dayKeys(TREND_DAYS, timeZone, now);
    const notTrashed = isNull(posts.deletedAt);
    const isPublished = and(eq(posts.status, 'published'), notTrashed);
    // A day's margin before the first day; rows outside the days are dropped.
    const since = new Date(now - (TREND_DAYS + 1) * DAY_MS);
    const perDay = (rows: { at: Date | null; value: number }[]) =>
      bucketByDay(
        dayList,
        rows.flatMap((row) =>
          row.at ? [{ day: dayKey(row.at.getTime(), timeZone), value: Number(row.value) }] : []
        )
      );

    // One round trip to the database for the settings and every panel.
    const [
      postCounts,
      mediaTotals,
      locationRows,
      drafts,
      published,
      upcomingEvents,
      mediaKinds,
      mediaUploads,
      bookedRows,
    ] = await db.batch([
      db
        .select({
          published: sql<number>`coalesce(sum(${posts.status} = 'published'), 0)`,
          drafts: sql<number>`coalesce(sum(${posts.status} = 'draft'), 0)`,
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
        .select({
          id: locations.id,
          name: locations.name,
          stage: locations.stage,
          state: locations.state,
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
      db
        .select({ title: events.title, startsAt: events.startsAt })
        .from(events)
        .where(and(eq(events.status, 'published'), gte(events.startsAt, new Date(now))))
        .orderBy(asc(events.startsAt)),
      // The library's bytes by kind, for the media card's meter.
      db
        .select({ kind: fileKind, files: count(), bytes: sum(media.size) })
        .from(media)
        .groupBy(fileKind),
      // Each upload's day and size, for what the span brought into the library.
      db
        .select({ at: media.createdAt, bytes: media.size })
        .from(media)
        .where(gte(media.createdAt, since)),
      // People booked, by when they booked (cancellations left out).
      db
        .select({ at: eventBookings.createdAt, value: eventBookings.partySize })
        .from(eventBookings)
        .where(and(gte(eventBookings.createdAt, since), eq(eventBookings.status, 'confirmed'))),
    ]);

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
      },
      media: {
        files: mediaTotals[0]?.files ?? 0,
        bytes: Number(mediaTotals[0]?.bytes ?? 0),
        missingAlt: Number(mediaTotals[0]?.missingAlt ?? 0),
        allowanceBytes: MEDIA_ALLOWANCE_BYTES,
        kinds: mediaKinds.map((r) => ({
          kind: r.kind,
          files: r.files,
          bytes: Number(r.bytes ?? 0),
        })),
        growth: growthOf(mediaUploads, dayList.slice(-90), timeZone),
      },
      events: {
        upcoming: upcomingEvents.length,
        next: upcomingEvents[0]
          ? { title: upcomingEvents[0].title, startsAt: upcomingEvents[0].startsAt.getTime() }
          : null,
        bookedDaily: perDay(bookedRows),
        /** Whether the card may lead to the events overview. */
        canManage: can(user, 'events:manage'),
      },
      locations: locationRows,
      /** The days the cards' daily counts cover, oldest first, ending today: "2026-11-14". */
      trendDays: dayList,
      /** Whether the trend card can show the website's traffic. */
      analytics: hasAnalytics(),
      recentDrafts: drafts.map(toSummary),
      recentlyPublished: published.map(toSummary),
      attention: await attention,
      scores: await scores,
    };
  });

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const UPCOMING_DAYS = 14;

/**
 * What needs someone's attention, limited to what their role lets them act on.
 * Each part is null when the role cannot see it, so the card leaves it out.
 */
async function loadAttention(
  db: ReturnType<typeof getDb>,
  user: { id: string } & Access,
  now: number
) {
  const canPublish = can(user, 'posts:publish');
  const canCheck = canPublish || can(user, 'seo:write');
  const canRedirect = can(user, 'redirects:write');
  const canEvents = can(user, 'events:manage');
  const canSeeSystem = can(user, 'settings:write');
  const inReview = and(isNull(posts.deletedAt), isNotNull(posts.reviewRequestedAt));

  const [reviews, scheduled, checks, missing, upcoming, jobs, health] = await Promise.all([
    canPublish
      ? db
          .select({
            total: count(),
            forYou: sql<number>`coalesce(sum(${posts.reviewerId} is null or ${posts.reviewerId} = ${user.id}), 0)`,
          })
          .from(posts)
          .where(inReview)
      : null,
    canPublish
      ? db
          .select({ total: count() })
          .from(posts)
          .where(
            and(
              isNull(posts.deletedAt),
              eq(posts.status, 'draft'),
              gte(posts.scheduledAt, new Date(now)),
              lt(posts.scheduledAt, new Date(now + 7 * DAY_MS))
            )
          )
      : null,
    canCheck ? loadContentChecks(db, { fresh: false }) : null,
    canRedirect ? loadMissingPages(db) : null,
    canEvents
      ? db
          .select({
            id: events.id,
            title: events.title,
            startsAt: events.startsAt,
            guests: sql<number>`coalesce(sum(case when ${eventBookings.status} = 'confirmed' then ${eventBookings.partySize} end), 0)`,
          })
          .from(events)
          .leftJoin(eventBookings, eq(eventBookings.eventId, events.id))
          .where(
            and(
              eq(events.status, 'published'),
              gte(events.startsAt, new Date(now)),
              lt(events.startsAt, new Date(now + UPCOMING_DAYS * DAY_MS))
            )
          )
          .groupBy(events.id)
          .orderBy(asc(events.startsAt))
      : null,
    canSeeSystem ? loadJobHealth(db, now) : null,
    // Without the website and storage checks: the dashboard never waits on them.
    canSeeSystem ? runHealthChecks(healthOptions(false)) : null,
  ]);

  return {
    reviews: reviews && {
      total: Number(reviews[0]?.total ?? 0),
      forYou: Number(reviews[0]?.forYou ?? 0),
    },
    /** What the System page flags: jobs failed or stopped, and failing health checks. */
    system: jobs &&
      health && {
        jobs: jobs.needsLook,
        health: health.filter((check) => check.status === 'problem').length,
      },
    scheduledThisWeek: scheduled && Number(scheduled[0]?.total ?? 0),
    contentIssues:
      checks &&
      checks.noDescription.total +
        checks.noImage.total +
        checks.noAlt.total +
        checks.events.total +
        checks.brand.total +
        checks.links.total,
    missingPages: missing && {
      total: missing.length,
      busiest: missing[0] ? { path: missing[0].path, hits: missing[0].hits } : null,
    },
    upcomingEvents: upcoming && {
      days: UPCOMING_DAYS,
      total: upcoming.length,
      next: upcoming[0]
        ? {
            id: upcoming[0].id,
            title: upcoming[0].title,
            startsAt: upcoming[0].startsAt.getTime(),
            guests: Number(upcoming[0].guests),
          }
        : null,
    },
  };
}

export type Attention = DashboardData['attention'];

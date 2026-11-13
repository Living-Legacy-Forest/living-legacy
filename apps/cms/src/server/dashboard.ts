import { type Role, can } from '@ll/content';
import { eventBookings, events, locations, media, posts } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  sql,
  sum,
} from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { getDb } from '@/lib/db';
import { TREND_MONTHS, monthKeys, monthStartMs, toMonths, zoneOffsetMs } from '@/lib/month-trend';
import { readSiteSettings } from '@/lib/site-settings';
import { authMiddleware } from '@/lib/session';
import { monthOf } from './month-sql';
import { loadContentChecks } from './content-checks';
import { loadMissingPages } from './not-found';
import { loadScoreSummary } from './post-score';
import { hasAnalytics } from './dashboard-trend-store';
import { healthOptions, runHealthChecks } from './system-health';
import { loadJobHealth } from './system-store';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** How far back the stat cards' trend bars go. */
export const TREND_WEEKS = 12;

/** Counts per week, oldest first; the last entry is the seven days up to now. */
function toWeeks(rows: { week: number; n: number }[]) {
  const weeks = Array.from({ length: TREND_WEEKS }, () => 0);
  for (const { week, n } of rows) {
    if (week >= 0 && week < TREND_WEEKS) weeks[TREND_WEEKS - 1 - week] = Number(n);
  }
  return weeks;
}

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
    const { role } = context.user;
    const scores =
      can(role, 'posts:publish') || can(role, 'seo:write') ? loadScoreSummary(db) : null;
    // Calendar months in the site's zone, for the cards' Months view.
    const { timeZone } = await readSiteSettings();
    const offset = zoneOffsetMs(now, timeZone);
    const months = monthKeys(now, offset, TREND_MONTHS);
    const monthsStart = new Date(monthStartMs(months[0]!, offset));
    const monthly = (table: typeof posts | typeof media, at: SQLiteColumn, where?: SQL) => {
      const month = monthOf(at, offset);
      return db
        .select({ month, n: count() })
        .from(table)
        .where(and(gte(at, monthsStart), where))
        .groupBy(month);
    };
    const notTrashed = isNull(posts.deletedAt);
    const isPublished = and(eq(posts.status, 'published'), notTrashed);
    const trendStart = new Date(now - TREND_WEEKS * WEEK_MS);
    // Rows per week for the stat cards' trend bars: 0 is this week, 1 the one before.
    const weekly = (table: typeof posts | typeof media, at: SQLiteColumn, where?: SQL) => {
      const week = sql<number>`cast((${now} - ${at}) / ${WEEK_MS} as integer)`;
      return db
        .select({ week, n: count() })
        .from(table)
        .where(and(gte(at, trendStart), where))
        .groupBy(week);
    };
    // People booked per week, by when they booked (cancellations left out).
    const bookedWeek = sql<number>`cast((${now} - ${eventBookings.createdAt}) / ${WEEK_MS} as integer)`;

    // One round trip to the database for the settings and every panel.
    const [
      postCounts,
      mediaTotals,
      locationRows,
      drafts,
      published,
      publishedWeekly,
      startedWeekly,
      uploadedWeekly,
      upcomingEvents,
      bookedWeekly,
      publishedMonthly,
      startedMonthly,
      uploadedMonthly,
      bookedMonthly,
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
      weekly(posts, posts.publishedAt, isPublished),
      weekly(posts, posts.createdAt, notTrashed),
      weekly(media, media.createdAt),
      db
        .select({ title: events.title, startsAt: events.startsAt })
        .from(events)
        .where(and(eq(events.status, 'published'), gte(events.startsAt, new Date(now))))
        .orderBy(asc(events.startsAt)),
      db
        .select({ week: bookedWeek, n: sql<number>`coalesce(sum(${eventBookings.partySize}), 0)` })
        .from(eventBookings)
        .where(and(gte(eventBookings.createdAt, trendStart), eq(eventBookings.status, 'confirmed')))
        .groupBy(bookedWeek),
      monthly(posts, posts.publishedAt, isPublished),
      monthly(posts, posts.createdAt, notTrashed),
      monthly(media, media.createdAt),
      db
        .select({
          month: monthOf(eventBookings.createdAt, offset),
          n: sql<number>`coalesce(sum(${eventBookings.partySize}), 0)`,
        })
        .from(eventBookings)
        .where(
          and(gte(eventBookings.createdAt, monthsStart), eq(eventBookings.status, 'confirmed'))
        )
        .groupBy(monthOf(eventBookings.createdAt, offset)),
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
        publishedWeekly: toWeeks(publishedWeekly),
        startedWeekly: toWeeks(startedWeekly),
        publishedMonthly: toMonths(publishedMonthly, months),
        startedMonthly: toMonths(startedMonthly, months),
      },
      media: {
        files: mediaTotals[0]?.files ?? 0,
        bytes: Number(mediaTotals[0]?.bytes ?? 0),
        missingAlt: Number(mediaTotals[0]?.missingAlt ?? 0),
        uploadedWeekly: toWeeks(uploadedWeekly),
        uploadedMonthly: toMonths(uploadedMonthly, months),
      },
      events: {
        upcoming: upcomingEvents.length,
        next: upcomingEvents[0]
          ? { title: upcomingEvents[0].title, startsAt: upcomingEvents[0].startsAt.getTime() }
          : null,
        bookedWeekly: toWeeks(bookedWeekly),
        bookedMonthly: toMonths(bookedMonthly, months),
        /** Whether the card may lead to the events overview. */
        canManage: can(role, 'events:manage'),
      },
      locations: locationRows,
      /** When the trend weeks end: the last one is the seven days up to this. */
      trendEndsAt: now,
      /** The calendar months the Months view covers, oldest first, as "2026-11". */
      trendMonths: months,
      /** Whether the trend card can offer visits and page views. */
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
  user: { id: string; role: Role },
  now: number
) {
  const canPublish = can(user.role, 'posts:publish');
  const canCheck = canPublish || can(user.role, 'seo:write');
  const canRedirect = can(user.role, 'redirects:write');
  const canEvents = can(user.role, 'events:manage');
  const canSeeSystem = can(user.role, 'settings:write');
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
    canCheck ? loadContentChecks(db) : null,
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
      checks.noDescription.total + checks.noImage.total + checks.noAlt.total + checks.events.total,
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

// The trend card's readings: analytics and the CMS's own tables. Server only.

import { eventBookings, posts } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { dayKey } from '@/lib/dashboard-trend';

const TTL_MS = 10 * 60 * 1000;

type Secrets = {
  POSTHOG_PERSONAL_API_KEY?: string;
  POSTHOG_PROJECT_ID?: string;
  POSTHOG_API_HOST?: string;
};

function analyticsKeys() {
  const {
    POSTHOG_PERSONAL_API_KEY: key,
    POSTHOG_PROJECT_ID: project,
    POSTHOG_API_HOST: host,
  } = env as unknown as Secrets;
  return key && project ? { key, project, host: host || 'https://us.posthog.com' } : null;
}

/** Whether the website's analytics can be read, so the card offers visits and page views. */
export const hasAnalytics = () => analyticsKeys() !== null;

type Reading = { day: string; value: number };
type Visits = { visitors: Reading[]; visits: Reading[]; pageviews: Reading[] };

// Per isolate, by zone and span: both analytics metrics come from one query, and they change slowly.
const cache = new Map<string, { at: number; readings: Visits }>();

/** Visits (distinct sessions) and page views per day in `zone`, over the last `span` days. */
export async function loadVisits(span: number, zone: string): Promise<Visits> {
  const keys = analyticsKeys();
  if (!keys) throw new Error('Website analytics are not connected to the CMS.');
  const cacheKey = `${zone}|${span}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.readings;

  const response = await fetch(`${keys.host}/api/projects/${keys.project}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${keys.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        // A day more than asked for, so the oldest day in the zone is whole.
        query: `SELECT toString(toDate(toTimeZone(timestamp, {zone}))) AS day,
            count(DISTINCT properties.$session_id) AS visits, count() AS views,
            count(DISTINCT distinct_id) AS visitors
          FROM events
          WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${span + 1} DAY
          GROUP BY day`,
        values: { zone },
      },
    }),
  });
  if (!response.ok) throw new Error('Could not load website visits. Try again in a minute.');
  const { results } = (await response.json()) as { results: [string, number, number, number][] };
  const readings = {
    visitors: results.map(([day, , , visitors]) => ({ day, value: Number(visitors) })),
    visits: results.map(([day, visits]) => ({ day, value: Number(visits) })),
    pageviews: results.map(([day, , views]) => ({ day, value: Number(views) })),
  };
  cache.set(cacheKey, { at: Date.now(), readings });
  return readings;
}

const distinctCache = new Map<string, { at: number; totals: DistinctTotals }>();
export type DistinctTotals = { current: number; previous: number };

/**
 * Distinct visitors across a whole period and the one before it, each counted once however
 * many days they came back. Adding up the daily counts would count them again every day.
 * `currentFrom` and `previousFrom` are calendar dates in `zone`.
 */
export async function loadDistinctVisitors(
  zone: string,
  currentFrom: string,
  previousFrom: string
): Promise<DistinctTotals> {
  const keys = analyticsKeys();
  if (!keys) throw new Error('Website analytics are not connected to the CMS.');
  const cacheKey = `${zone}|${previousFrom}|${currentFrom}`;
  const hit = distinctCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.totals;

  const response = await fetch(`${keys.host}/api/projects/${keys.project}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${keys.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: `SELECT uniqIf(distinct_id, toDate(toTimeZone(timestamp, {zone})) >= toDate({currentFrom})) AS current,
            uniqIf(distinct_id, toDate(toTimeZone(timestamp, {zone})) < toDate({currentFrom})) AS previous
          FROM events
          WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 400 DAY
            AND toDate(toTimeZone(timestamp, {zone})) >= toDate({previousFrom})`,
        values: { zone, currentFrom, previousFrom },
      },
    }),
  });
  if (!response.ok) throw new Error('Could not load website visitors. Try again in a minute.');
  const { results } = (await response.json()) as { results: [number, number][] };
  const totals = { current: Number(results[0]?.[0] ?? 0), previous: Number(results[0]?.[1] ?? 0) };
  distinctCache.set(cacheKey, { at: Date.now(), totals });
  return totals;
}

/** People booked (party sizes, cancellations left out) or posts first published, per day in `zone`. */
export async function loadContent(metric: 'booked' | 'published', since: number, zone: string) {
  const db = getDb();
  const from = new Date(since);
  const rows =
    metric === 'booked'
      ? await db
          .select({ at: eventBookings.createdAt, value: eventBookings.partySize })
          .from(eventBookings)
          .where(and(gte(eventBookings.createdAt, from), eq(eventBookings.status, 'confirmed')))
      : await db
          .select({ at: posts.publishedAt, value: sql<number>`1` })
          .from(posts)
          .where(
            and(
              eq(posts.status, 'published'),
              isNull(posts.deletedAt),
              gte(posts.publishedAt, from)
            )
          );
  return rows.flatMap((row) =>
    row.at ? [{ day: dayKey(row.at.getTime(), zone), value: Number(row.value) }] : []
  );
}

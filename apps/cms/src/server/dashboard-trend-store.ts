// The trend card's readings, from the website's analytics. Server only.

import { env } from 'cloudflare:workers';
import { bucketByDay, dayKeys, trendRanges } from '@/lib/dashboard-trend';
import { readThrough, refresh } from './analytics-cache';

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

/** Whether the website's analytics can be read, so the dashboard can show its traffic. */
export const hasAnalytics = () => analyticsKeys() !== null;

type Reading = { day: string; value: number };
type Visits = { visitors: Reading[]; pageviews: Reading[] };
export type DistinctTotals = { current: number; previous: number };
export type BlogViews = {
  /** Views per day, one per day given, oldest first. */
  days: number[];
  /** Distinct browsers per day: the readers behind the views. */
  readers: number[];
};

/** Runs one HogQL query. PostHog can be slow over months of pageviews, so it has a long timeout. */
async function hogql<Row>(
  keys: NonNullable<ReturnType<typeof analyticsKeys>>,
  query: string,
  values: Record<string, string>,
  failure: string
): Promise<Row[]> {
  const response = await fetch(`${keys.host}/api/projects/${keys.project}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${keys.key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query, values } }),
  });
  if (!response.ok) {
    console.error(failure, response.status, (await response.text()).slice(0, 300));
    throw new Error(`${failure}. Try again in a minute.`);
  }
  return ((await response.json()) as { results: Row[] }).results;
}

const NOT_CONNECTED = 'Website analytics are not connected to the CMS.';

// Each query below is stored in D1 (analytics-cache.ts): a page reads the stored answer and the
// refresh job at the foot of this file keeps it current.

async function fetchVisits(span: number, zone: string): Promise<Visits> {
  const keys = analyticsKeys();
  if (!keys) throw new Error(NOT_CONNECTED);
  const results = await hogql<[string, number, number]>(
    keys,
    // A day more than asked for, so the oldest day in the zone is whole.
    `SELECT toString(toDate(toTimeZone(timestamp, {zone}))) AS day,
        count() AS views, count(DISTINCT distinct_id) AS visitors
      FROM events
      WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${span + 1} DAY
      GROUP BY day`,
    { zone },
    'Could not load website traffic'
  );
  return {
    pageviews: results.map(([day, views]) => ({ day, value: Number(views) })),
    visitors: results.map(([day, , visitors]) => ({ day, value: Number(visitors) })),
  };
}

/** Distinct visitors and page views per day in `zone`, over the last `span` days. */
export function loadVisits(span: number, zone: string): Promise<Visits> {
  if (!analyticsKeys()) throw new Error(NOT_CONNECTED);
  return readThrough(env.DB, `visits|${zone}|${span}`, () => fetchVisits(span, zone));
}

async function fetchDistinct(
  zone: string,
  currentFrom: string,
  previousFrom: string
): Promise<DistinctTotals> {
  const keys = analyticsKeys();
  if (!keys) throw new Error(NOT_CONNECTED);
  const results = await hogql<[number, number]>(
    keys,
    `SELECT uniqIf(distinct_id, toDate(toTimeZone(timestamp, {zone})) >= toDate({currentFrom})) AS current,
        uniqIf(distinct_id, toDate(toTimeZone(timestamp, {zone})) < toDate({currentFrom})) AS previous
      FROM events
      WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 400 DAY
        AND toDate(toTimeZone(timestamp, {zone})) >= toDate({previousFrom})`,
    { zone, currentFrom, previousFrom },
    'Could not load website visitors'
  );
  return { current: Number(results[0]?.[0] ?? 0), previous: Number(results[0]?.[1] ?? 0) };
}

/**
 * Distinct visitors across a whole period and the one before it, each counted once however
 * many days they came back. Adding up the daily counts would count them again every day.
 * `currentFrom` and `previousFrom` are calendar dates in `zone`.
 */
export function loadDistinctVisitors(
  zone: string,
  currentFrom: string,
  previousFrom: string
): Promise<DistinctTotals> {
  if (!analyticsKeys()) throw new Error(NOT_CONNECTED);
  return readThrough(env.DB, `distinct|${zone}|${previousFrom}|${currentFrom}`, () =>
    fetchDistinct(zone, currentFrom, previousFrom)
  );
}

async function fetchBlogViews(zone: string, dayList: string[]): Promise<BlogViews> {
  const keys = analyticsKeys();
  if (!keys) throw new Error(NOT_CONNECTED);
  const results = await hogql<[string, number, number]>(
    keys,
    `SELECT toString(toDate(toTimeZone(timestamp, {zone}))) AS day,
        count() AS views, count(DISTINCT distinct_id) AS readers
      FROM events
      WHERE event = '$pageview'
        AND (properties.$pathname = '/blog' OR startsWith(properties.$pathname, '/blog/'))
        AND timestamp >= now() - INTERVAL ${dayList.length + 1} DAY
      GROUP BY day`,
    { zone },
    'Blog views query failed'
  );
  return {
    days: bucketByDay(
      dayList,
      results.map(([day, n]) => ({ day, value: Number(n) }))
    ),
    readers: bucketByDay(
      dayList,
      results.map(([day, , n]) => ({ day, value: Number(n) }))
    ),
  };
}

const blogKey = (zone: string, dayList: string[]) => `blog|${zone}|${dayList[0]}|${dayList.length}`;

/**
 * Views of the website's blog pages (the articles, the blog's home and its category, tag and
 * author pages), and the readers behind them, on each of `dayList` (calendar dates in `zone`,
 * oldest first). `null` when analytics are not connected or cannot be reached, so the
 * dashboard carries on; a failure is logged.
 */
export async function loadBlogViews(zone: string, dayList: string[]): Promise<BlogViews | null> {
  if (!analyticsKeys()) return null;
  try {
    return await readThrough(env.DB, blogKey(zone, dayList), () => fetchBlogViews(zone, dayList));
  } catch (error) {
    console.error('Blog views query failed', error);
    return null;
  }
}

/**
 * Every five minutes: renews the answers the dashboard reads, each once it is 12 minutes old,
 * so a page finds them ready. Covers the three ranges of the traffic card and the blog card's
 * window (server/blog-views.ts asks for twice the longest range). Each is tried on its own, and the first failure is thrown once all have been tried.
 */
export async function refreshAnalytics(d1: D1Database, zone: string, now = Date.now()) {
  if (!analyticsKeys()) return;
  const jobs: Promise<unknown>[] = [];
  for (const days of trendRanges) {
    const keys = dayKeys(days * 2, zone, now);
    jobs.push(
      refresh(d1, `visits|${zone}|${days * 2}`, () => fetchVisits(days * 2, zone), now),
      refresh(
        d1,
        `distinct|${zone}|${keys[0]}|${keys[days]}`,
        () => fetchDistinct(zone, keys[days]!, keys[0]!),
        now
      )
    );
  }
  const blogDays = dayKeys(Math.max(...trendRanges) * 2, zone, now);
  jobs.push(refresh(d1, blogKey(zone, blogDays), () => fetchBlogViews(zone, blogDays), now));
  const failed = (await Promise.allSettled(jobs)).find((r) => r.status === 'rejected');
  if (failed) throw (failed as PromiseRejectedResult).reason;
}

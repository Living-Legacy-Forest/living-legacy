// The Visitors page: recent visits to the website, one row per session, from PostHog.
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requirePermission } from '@/lib/session';
import {
  VISITOR_PAGE_SIZES,
  VISITOR_RANGES,
  VISITORS_PAGE_SIZE,
  type VisitorPageSize,
  type VisitorRange,
  type VisitorSession,
  deviceKind,
  trafficSource,
} from '@/lib/visitors';
import { readThrough } from './analytics-cache';
import { analyticsKeys, hogql } from './dashboard-trend-store';

/** A list of recent visits goes stale faster than a trend; the dashboard's hour is too long. */
const MAX_AGE_MS = 5 * 60 * 1000;

// Pageviews only, and none of the site's own API calls, which are not visits.
const WHERE = (days: VisitorRange) => `event = '$pageview'
  AND timestamp >= now() - INTERVAL ${days} DAY
  AND $session_id != ''
  AND NOT startsWith(coalesce(properties.$pathname, ''), '/api/')`;

type Row = [
  session: string,
  lastView: number,
  views: number,
  entryPath: string | null,
  entryTitle: string | null,
  exitPath: string | null,
  exitTitle: string | null,
  referrer: string | null,
  country: string | null,
  countryName: string | null,
  city: string | null,
  os: string | null,
  browser: string | null,
  device: string | null,
];

type Visits = { rows: VisitorSession[]; total: number };

async function fetchVisits(
  days: VisitorRange,
  page: number,
  size: VisitorPageSize
): Promise<Visits> {
  const keys = analyticsKeys();
  if (!keys) throw new Error('Website analytics are not connected to the CMS.');
  const offset = (page - 1) * size;
  // The details are the ones from the visit's first page, as that is where it started. A personal
  // API key cannot use OFFSET, so this reads every visit up to the end of the page and drops the
  // ones before it.
  const [rows, [count]] = await Promise.all([
    hogql<Row>(
      keys,
      `SELECT $session_id AS session,
          toUnixTimestamp(max(timestamp)) AS last_view,
          count() AS views,
          argMin(properties.$pathname, timestamp),
          argMin(properties.title, timestamp),
          argMax(properties.$pathname, timestamp),
          argMax(properties.title, timestamp),
          argMin(properties.$referring_domain, timestamp),
          argMin(properties.$geoip_country_code, timestamp),
          argMin(properties.$geoip_country_name, timestamp),
          argMin(properties.$geoip_city_name, timestamp),
          argMin(properties.$os, timestamp),
          argMin(properties.$browser, timestamp),
          argMin(properties.$device_type, timestamp)
        FROM events
        WHERE ${WHERE(days)}
        GROUP BY session
        ORDER BY max(timestamp) DESC
        LIMIT ${offset + size}`,
      {},
      'Could not load website visitors'
    ),
    hogql<[number]>(
      keys,
      `SELECT uniq($session_id) FROM events WHERE ${WHERE(days)}`,
      {},
      'Could not load website visitors'
    ),
  ]);
  return {
    total: Number(count?.[0] ?? 0),
    rows: rows.slice(offset).map((r) => {
      const [id, last, views, entryPath, entryTitle, exitPath, exitTitle, referring] = r;
      const [, , , , , , , , country, countryName, city, os, browser, device] = r;
      return {
        id,
        // Seconds since 1970: a timestamp as text would come in the PostHog project's own zone.
        lastView: Number(last) * 1000,
        views: Number(views),
        entry: { path: entryPath ?? '/', title: entryTitle ?? '' },
        exit: { path: exitPath ?? '/', title: exitTitle ?? '' },
        ...trafficSource(referring),
        country: country || null,
        countryName: countryName || null,
        city: city || null,
        os: os || null,
        browser: browser || null,
        device: deviceKind(device),
      };
    }),
  };
}

export type VisitorsData =
  | { connected: false }
  | {
      connected: true;
      days: VisitorRange;
      page: number;
      pageSize: VisitorPageSize;
      pageCount: number;
      total: number;
      rows: VisitorSession[];
      /** Set when PostHog could not answer and there was nothing stored to show. */
      error?: string;
    };

export const listVisitors = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(
    z.object({
      days: z
        .union(
          VISITOR_RANGES.map((d) => z.literal(d)) as [
            z.ZodLiteral<7>,
            z.ZodLiteral<30>,
            z.ZodLiteral<90>,
          ]
        )
        .catch(30),
      page: z.number().int().min(1).max(200).catch(1),
      rows: z
        .union(
          VISITOR_PAGE_SIZES.map((n) => z.literal(n)) as [
            z.ZodLiteral<25>,
            z.ZodLiteral<50>,
            z.ZodLiteral<100>,
          ]
        )
        .catch(VISITORS_PAGE_SIZE),
    })
  )
  .handler(async ({ data }): Promise<VisitorsData> => {
    if (!analyticsKeys()) return { connected: false };
    const { days, page, rows: pageSize } = data;
    try {
      const visits = await readThrough(
        env.DB,
        `visitors2|${days}|${page}|${pageSize}`,
        () => fetchVisits(days, page, pageSize),
        Date.now(),
        MAX_AGE_MS
      );
      return {
        connected: true,
        days,
        page,
        pageSize,
        total: visits.total,
        pageCount: Math.max(1, Math.ceil(visits.total / pageSize)),
        rows: visits.rows,
      };
    } catch (error) {
      console.error('Visitors query failed', error);
      return {
        connected: true,
        days,
        page,
        pageSize,
        total: 0,
        pageCount: 1,
        rows: [],
        error: 'Could not load website visitors. Try again in a minute.',
      };
    }
  });

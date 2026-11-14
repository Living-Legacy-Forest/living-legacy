// The Visitors page: recent visits to the website, one row per session, from PostHog.
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requirePermission } from '@/lib/session';
import {
  VISITORS_PAGE_SIZE,
  VISITOR_RANGES,
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
  lastView: string,
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

async function fetchVisits(days: VisitorRange, page: number): Promise<Visits> {
  const keys = analyticsKeys();
  if (!keys) throw new Error('Website analytics are not connected to the CMS.');
  const offset = (page - 1) * VISITORS_PAGE_SIZE;
  // The details are the ones from the visit's first page, as that is where it started.
  const [rows, [count]] = await Promise.all([
    hogql<Row>(
      keys,
      `SELECT $session_id AS session,
          toString(max(timestamp)) AS last_view,
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
        LIMIT ${VISITORS_PAGE_SIZE} OFFSET ${offset}`,
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
    rows: rows.map((r) => {
      const [id, last, views, entryPath, entryTitle, exitPath, exitTitle, referring] = r;
      const [, , , , , , , , country, countryName, city, os, browser, device] = r;
      return {
        id,
        // ClickHouse writes "2026-11-14 03:57:12.345000" in UTC.
        lastView: Date.parse(`${last.replace(' ', 'T')}Z`) || Date.parse(last) || 0,
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
    })
  )
  .handler(async ({ data }): Promise<VisitorsData> => {
    if (!analyticsKeys()) return { connected: false };
    const { days, page } = data;
    try {
      const visits = await readThrough(
        env.DB,
        `visitors|${days}|${page}`,
        () => fetchVisits(days, page),
        Date.now(),
        MAX_AGE_MS
      );
      return {
        connected: true,
        days,
        page,
        total: visits.total,
        pageCount: Math.max(1, Math.ceil(visits.total / VISITORS_PAGE_SIZE)),
        rows: visits.rows,
      };
    } catch (error) {
      console.error('Visitors query failed', error);
      return {
        connected: true,
        days,
        page,
        total: 0,
        pageCount: 1,
        rows: [],
        error: 'Could not load website visitors. Try again in a minute.',
      };
    }
  });

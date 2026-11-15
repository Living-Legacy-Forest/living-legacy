// The Analytics pages: the website's traffic, pages, sources, audience and enquiries, from
// PostHog. Each answer is kept in D1 for a few minutes (analytics-cache.ts), so moving between
// the pages and back does not ask PostHog again.
import { locations } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import {
  type AnalyticsRange,
  type Channel,
  type Ranked,
  channelLabels,
  channelOf,
  formLabels,
  rangeInput,
  rollUp,
} from '@/lib/analytics';
import { bucketByDay, dayKeys } from '@/lib/dashboard-trend';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { deviceKind } from '@/lib/visitors';
import { readThrough } from './analytics-cache';
import { analyticsKeys, hogql } from './dashboard-trend-store';

/** Long enough to move between the pages, short enough that a new visit soon shows. */
const MAX_AGE_MS = 10 * 60 * 1000;

const NOT_API = `NOT startsWith(coalesce(properties.$pathname, ''), '/api/')`;
/** Page views over the last `days`, without the site's own API calls, which are not visits. */
const pageviews = (days: number) =>
  `event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY AND ${NOT_API}`;
/** One row per visit, with what its first page said: where it came from, and who. */
const firstOfEachVisit = (days: number, columns: string) => `(
  SELECT ${columns}
  FROM events
  WHERE ${pageviews(days)} AND $session_id != ''
  GROUP BY $session_id
)`;

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const maybeNum = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function keys() {
  const found = analyticsKeys();
  if (!found) throw new Error('Website analytics are not connected to the CMS.');
  return found;
}

const cached = <T>(name: string, days: AnalyticsRange, fetch: () => Promise<T>, extra = '') =>
  readThrough(env.DB, `analytics|${name}|${days}${extra}`, fetch, Date.now(), MAX_AGE_MS);

// --- Pages -----------------------------------------------------------------------------------

export type PageRow = {
  path: string;
  title: string | null;
  views: number;
  visitors: number;
  /** Visits that started on this page. */
  entries: number;
  /** Visits that started here and went no further. */
  bounces: number;
  /** Visits that ended on this page. */
  exits: number;
  /** Average time on the page, in seconds; null when PostHog has not timed it. */
  seconds: number | null;
};

async function fetchPages(days: AnalyticsRange): Promise<PageRow[]> {
  const k = keys();
  const failure = 'Could not load the website’s pages';
  const [views, entries, exits, times] = await Promise.all([
    hogql<[string, string | null, number, number]>(
      k,
      `SELECT properties.$pathname AS path, argMax(properties.title, timestamp),
          count() AS views, uniq(distinct_id)
        FROM events
        WHERE ${pageviews(days)} AND path IS NOT NULL
        GROUP BY path ORDER BY views DESC LIMIT 200`,
      {},
      failure
    ),
    hogql<[string, number, number]>(
      k,
      `SELECT entry, count() AS visits, countIf(views = 1)
        FROM ${firstOfEachVisit(days, 'argMin(properties.$pathname, timestamp) AS entry, count() AS views')}
        GROUP BY entry ORDER BY visits DESC LIMIT 500`,
      {},
      failure
    ),
    hogql<[string, number]>(
      k,
      `SELECT exit, count() AS visits
        FROM ${firstOfEachVisit(days, 'argMax(properties.$pathname, timestamp) AS exit')}
        GROUP BY exit ORDER BY visits DESC LIMIT 500`,
      {},
      failure
    ),
    // PostHog times a page when the next page opens or the tab closes, and puts the time on
    // that later event.
    hogql<[string, number]>(
      k,
      `SELECT properties.$prev_pageview_pathname AS path, avg(toFloat(properties.$prev_pageview_duration))
        FROM events
        WHERE event IN ('$pageview', '$pageleave')
          AND timestamp >= now() - INTERVAL ${days} DAY
          AND path IS NOT NULL AND properties.$prev_pageview_duration IS NOT NULL
        GROUP BY path`,
      {},
      failure
    ),
  ]);
  const entryOf = new Map(entries.map(([path, n, bounced]) => [path, [num(n), num(bounced)]]));
  const exitOf = new Map(exits.map(([path, n]) => [path, num(n)]));
  const timeOf = new Map(times.map(([path, s]) => [path, maybeNum(s)]));
  return views.map(([path, title, n, visitors]) => ({
    path,
    title: text(title),
    views: num(n),
    visitors: num(visitors),
    entries: entryOf.get(path)?.[0] ?? 0,
    bounces: entryOf.get(path)?.[1] ?? 0,
    exits: exitOf.get(path) ?? 0,
    seconds: timeOf.get(path) ?? null,
  }));
}

const loadPages = (days: AnalyticsRange) => cached('pages', days, () => fetchPages(days));

// --- Traffic ---------------------------------------------------------------------------------

export type Traffic = {
  visits: number;
  channels: (Ranked & { key: Channel })[];
  /** Other websites that sent visits, biggest first; not search engines' own counts merged. */
  referrers: (Ranked & { channel: Channel })[];
  campaigns: { source: string; medium: string | null; campaign: string | null; visits: number }[];
};

async function fetchTraffic(days: AnalyticsRange): Promise<Traffic> {
  const rows = await hogql<[string | null, string | null, string | null, string | null, number]>(
    keys(),
    `SELECT referrer, source, medium, campaign, count() AS visits
      FROM ${firstOfEachVisit(
        days,
        `argMin(properties.$referring_domain, timestamp) AS referrer,
          argMin(properties.utm_source, timestamp) AS source,
          argMin(properties.utm_medium, timestamp) AS medium,
          argMin(properties.utm_campaign, timestamp) AS campaign`
      )}
      GROUP BY referrer, source, medium, campaign
      ORDER BY visits DESC LIMIT 2000`,
    {},
    'Could not load where visitors came from'
  );
  const visits = rows.map(([referrer, source, medium, campaign, n]) => ({
    ...channelOf(referrer, medium),
    utmSource: text(source),
    medium: text(medium),
    campaign: text(campaign),
    visits: num(n),
  }));
  const campaigns = new Map<string, Traffic['campaigns'][number]>();
  for (const v of visits) {
    if (!v.utmSource && !v.campaign) continue;
    const source = v.utmSource ?? v.referrer ?? 'Unknown';
    const key = [source, v.medium, v.campaign].join('|');
    const entry = campaigns.get(key) ?? {
      source,
      medium: v.medium,
      campaign: v.campaign,
      visits: 0,
    };
    entry.visits += v.visits;
    campaigns.set(key, entry);
  }
  return {
    visits: visits.reduce((n, v) => n + v.visits, 0),
    channels: rollUp(
      visits,
      (v) => v.channel,
      (v) => v.visits,
      (k) => channelLabels[k as Channel]
    ) as Traffic['channels'],
    referrers: rollUp(
      visits.filter((v) => v.referrer && v.source !== 'internal'),
      (v) => v.referrer,
      (v) => v.visits
    )
      .slice(0, 50)
      .map((r) => ({ ...r, channel: channelOf(r.key).channel })),
    campaigns: [...campaigns.values()].sort((a, b) => b.visits - a.visits).slice(0, 50),
  };
}

const loadTraffic = (days: AnalyticsRange) => cached('traffic', days, () => fetchTraffic(days));

// --- Audience --------------------------------------------------------------------------------

export type Audience = {
  visits: number;
  countries: (Ranked & { code: string | null })[];
  cities: (Ranked & { code: string | null })[];
  devices: Ranked[];
  browsers: Ranked[];
  systems: Ranked[];
};

const DEVICE_LABELS = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' } as const;

async function fetchAudience(days: AnalyticsRange): Promise<Audience> {
  const rows = await hogql<
    [
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      number,
    ]
  >(
    keys(),
    `SELECT code, country, city, device, browser, os, count() AS visits
      FROM ${firstOfEachVisit(
        days,
        `argMin(properties.$geoip_country_code, timestamp) AS code,
          argMin(properties.$geoip_country_name, timestamp) AS country,
          argMin(properties.$geoip_city_name, timestamp) AS city,
          argMin(properties.$device_type, timestamp) AS device,
          argMin(properties.$browser, timestamp) AS browser,
          argMin(properties.$os, timestamp) AS os`
      )}
      GROUP BY code, country, city, device, browser, os
      ORDER BY visits DESC LIMIT 5000`,
    {},
    'Could not load the website’s audience'
  );
  const visits = rows.map(([code, country, city, device, browser, os, n]) => ({
    code: text(code)?.toUpperCase() ?? null,
    country: text(country),
    city: text(city),
    device: deviceKind(device),
    browser: text(browser),
    os: text(os),
    visits: num(n),
  }));
  const count = (v: { visits: number }) => v.visits;
  return {
    visits: visits.reduce((n, v) => n + v.visits, 0),
    countries: rollUp(
      visits,
      (v) => v.code ?? v.country,
      count,
      (k, v) => v.country ?? k
    )
      .slice(0, 50)
      .map((r) => ({ ...r, code: /^[A-Z]{2}$/.test(r.key) ? r.key : null })),
    cities: rollUp(
      visits.filter((v) => v.city),
      (v) => `${v.city}|${v.code ?? ''}`,
      count,
      (_, v) => [v.city, v.country].filter(Boolean).join(', ')
    )
      .slice(0, 50)
      .map((r) => ({ ...r, code: r.key.split('|')[1] || null })),
    devices: rollUp(
      visits,
      (v) => v.device,
      count,
      (k) => DEVICE_LABELS[k as keyof typeof DEVICE_LABELS]
    ),
    browsers: rollUp(visits, (v) => v.browser, count).slice(0, 20),
    systems: rollUp(visits, (v) => v.os, count).slice(0, 20),
  };
}

const loadAudience = (days: AnalyticsRange) => cached('audience', days, () => fetchAudience(days));

// --- Overview --------------------------------------------------------------------------------

export type PeriodTotals = {
  visitors: number;
  views: number;
  visits: number;
  /** Visits that saw one page only. */
  bounces: number;
  /** Average visit length in seconds, or null with no visits. */
  seconds: number | null;
};

export type Overview = {
  current: PeriodTotals;
  previous: PeriodTotals;
  daily: { days: string[]; visitors: number[]; views: number[] };
  pages: PageRow[];
  channels: Traffic['channels'];
  countries: Audience['countries'];
};

async function fetchOverview(days: AnalyticsRange, zone: string) {
  const k = keys();
  const failure = 'Could not load website traffic';
  const inCurrent = (column: string) => `${column} >= now() - INTERVAL ${days} DAY`;
  const [[people], [visits], daily] = await Promise.all([
    hogql<[number, number, number, number]>(
      k,
      `SELECT uniqIf(distinct_id, ${inCurrent('timestamp')}), uniqIf(distinct_id, NOT ${inCurrent('timestamp')}),
          countIf(${inCurrent('timestamp')}), countIf(NOT ${inCurrent('timestamp')})
        FROM events WHERE ${pageviews(days * 2)}`,
      {},
      failure
    ),
    // A visit lasts from its first page to its last moment on the site, the tab closing
    // included, so a one-page visit still has a length when PostHog saw it leave.
    hogql<[number, number, number | null, number, number, number | null]>(
      k,
      `SELECT countIf(${inCurrent('start')}), countIf(${inCurrent('start')} AND views = 1),
          avgIf(seconds, ${inCurrent('start')}),
          countIf(NOT ${inCurrent('start')}), countIf(NOT ${inCurrent('start')} AND views = 1),
          avgIf(seconds, NOT ${inCurrent('start')})
        FROM (
          SELECT min(timestamp) AS start, countIf(event = '$pageview') AS views,
            dateDiff('second', min(timestamp), max(timestamp)) AS seconds
          FROM events
          WHERE event IN ('$pageview', '$pageleave')
            AND timestamp >= now() - INTERVAL ${days * 2} DAY AND ${NOT_API}
            AND $session_id != ''
          GROUP BY $session_id
          HAVING views > 0
        )`,
      {},
      failure
    ),
    hogql<[string, number, number]>(
      k,
      // A day more than asked for, so the oldest day in the zone is whole.
      `SELECT toString(toDate(toTimeZone(timestamp, {zone}))) AS day, count(), uniq(distinct_id)
        FROM events WHERE ${pageviews(days + 1)}
        GROUP BY day`,
      { zone },
      failure
    ),
  ]);
  const p = people ?? [0, 0, 0, 0];
  const v = visits ?? [0, 0, null, 0, 0, null];
  const dayList = dayKeys(days, zone);
  return {
    current: {
      visitors: num(p[0]),
      views: num(p[2]),
      visits: num(v[0]),
      bounces: num(v[1]),
      seconds: maybeNum(v[2]),
    },
    previous: {
      visitors: num(p[1]),
      views: num(p[3]),
      visits: num(v[3]),
      bounces: num(v[4]),
      seconds: maybeNum(v[5]),
    },
    daily: {
      days: dayList,
      views: bucketByDay(
        dayList,
        daily.map(([day, n]) => ({ day, value: num(n) }))
      ),
      visitors: bucketByDay(
        dayList,
        daily.map(([day, , n]) => ({ day, value: num(n) }))
      ),
    },
  };
}

// --- Enquiries -------------------------------------------------------------------------------

export type Enquiries = {
  total: number;
  /** Visits in the period, to set enquiries against. */
  visits: number;
  /** Visits that sent at least one enquiry. */
  enquiringVisits: number;
  daily: { days: string[]; counts: number[] };
  forms: Ranked[];
  locations: Ranked[];
  /** The page each form was sent from. */
  pages: (Ranked & { title: string | null })[];
  /** Where the visits that enquired started, against all visits that started there. */
  entries: { path: string; title: string | null; visits: number; enquired: number }[];
};

async function fetchEnquiries(days: AnalyticsRange, zone: string): Promise<Enquiries> {
  const k = keys();
  const failure = 'Could not load enquiries';
  const LEAD = `event = 'generate_lead' AND timestamp >= now() - INTERVAL ${days} DAY`;
  const [leads, daily, entries, names] = await Promise.all([
    hogql<[string | null, string | null, string | null, string | null, number]>(
      k,
      `SELECT properties.form_type, properties.location_slug, properties.$pathname,
          any(properties.title), count() AS n
        FROM events WHERE ${LEAD}
        GROUP BY properties.form_type, properties.location_slug, properties.$pathname
        ORDER BY n DESC LIMIT 1000`,
      {},
      failure
    ),
    hogql<[string, number]>(
      k,
      `SELECT toString(toDate(toTimeZone(timestamp, {zone}))) AS day, count()
        FROM events
        WHERE event = 'generate_lead' AND timestamp >= now() - INTERVAL ${days + 1} DAY
        GROUP BY day`,
      { zone },
      failure
    ),
    hogql<[string | null, string | null, number, number]>(
      k,
      `SELECT entry, any(title), count() AS visits, countIf(leads > 0) AS enquired
        FROM (
          SELECT argMinIf(properties.$pathname, timestamp, event = '$pageview') AS entry,
            argMinIf(properties.title, timestamp, event = '$pageview') AS title,
            countIf(event = 'generate_lead') AS leads
          FROM events
          WHERE event IN ('$pageview', 'generate_lead')
            AND timestamp >= now() - INTERVAL ${days} DAY AND ${NOT_API}
            AND $session_id != ''
          GROUP BY $session_id
        )
        WHERE entry IS NOT NULL AND entry != ''
        GROUP BY entry ORDER BY enquired DESC, visits DESC LIMIT 2000`,
      {},
      failure
    ),
    getDb().select({ slug: locations.slug, name: locations.name }).from(locations),
  ]);
  const locationName = new Map(names.map((l) => [l.slug, l.name]));
  const rows = leads.map(([form, slug, path, title, n]) => ({
    form: text(form),
    slug: text(slug),
    path: text(path),
    title: text(title),
    count: num(n),
  }));
  const count = (r: { count: number }) => r.count;
  const dayList = dayKeys(days, zone);
  const entryRows = entries.map(([path, title, visits, enquired]) => ({
    path: path ?? '/',
    title: text(title),
    visits: num(visits),
    enquired: num(enquired),
  }));
  return {
    total: rows.reduce((n, r) => n + r.count, 0),
    visits: entryRows.reduce((n, r) => n + r.visits, 0),
    enquiringVisits: entryRows.reduce((n, r) => n + r.enquired, 0),
    daily: {
      days: dayList,
      counts: bucketByDay(
        dayList,
        daily.map(([day, n]) => ({ day, value: num(n) }))
      ),
    },
    forms: rollUp(
      rows,
      (r) => r.form ?? 'other',
      count,
      (k) => formLabels[k] ?? 'Other'
    ),
    locations: rollUp(
      rows,
      (r) => r.slug ?? 'national',
      count,
      (k) => (k === 'national' ? 'Not about one location' : (locationName.get(k) ?? k))
    ),
    pages: rollUp(
      rows,
      (r) => r.path,
      count,
      (k) => k
    )
      .slice(0, 20)
      .map((p) => ({ ...p, title: rows.find((r) => r.path === p.key && r.title)?.title ?? null })),
    entries: entryRows.filter((r) => r.enquired > 0).slice(0, 20),
  };
}

// --- Server functions ------------------------------------------------------------------------

export type AnalyticsResult<T> =
  | { connected: false }
  | {
      connected: true;
      days: AnalyticsRange;
      /** Null when PostHog could not answer and there was nothing stored to show. */
      data: T | null;
      error?: string;
    };

async function serve<T>(
  what: string,
  days: AnalyticsRange,
  load: () => Promise<T>
): Promise<AnalyticsResult<T>> {
  if (!analyticsKeys()) return { connected: false };
  try {
    return { connected: true, days, data: await load() };
  } catch (error) {
    console.error(`Analytics: ${what} failed`, error);
    return {
      connected: true,
      days,
      data: null,
      error: `Could not load ${what}. Try again in a minute.`,
    };
  }
}

export const getAnalyticsOverview = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(rangeInput)
  .handler(({ data: { days } }) =>
    serve('website traffic', days, async () => {
      const { timeZone } = await readSiteSettings();
      // The lists come from the other pages' answers, so opening one of them next is instant.
      const [totals, pages, traffic, audience] = await Promise.all([
        cached('overview', days, () => fetchOverview(days, timeZone), `|${timeZone}`),
        loadPages(days),
        loadTraffic(days),
        loadAudience(days),
      ]);
      return {
        ...totals,
        pages: pages.slice(0, 8),
        channels: traffic.channels,
        countries: audience.countries.slice(0, 8),
      } satisfies Overview;
    })
  );

export const getAnalyticsPages = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(rangeInput)
  .handler(({ data: { days } }) => serve('the website’s pages', days, () => loadPages(days)));

export const getAnalyticsTraffic = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(rangeInput)
  .handler(({ data: { days } }) =>
    serve('where visitors came from', days, () => loadTraffic(days))
  );

export const getAnalyticsAudience = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(rangeInput)
  .handler(({ data: { days } }) => serve('the website’s audience', days, () => loadAudience(days)));

export const getAnalyticsEnquiries = createServerFn({ method: 'GET' })
  .middleware([requirePermission('posts:publish')])
  .validator(rangeInput)
  .handler(({ data: { days } }) =>
    serve('enquiries', days, async () => {
      const { timeZone } = await readSiteSettings();
      return cached('enquiries', days, () => fetchEnquiries(days, timeZone), `|${timeZone}`);
    })
  );

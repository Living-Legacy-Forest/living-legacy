// The Visitors page's rules: where a visit came from, and how its country and device show.
// Plain functions, shared by the server (which shapes PostHog's rows) and the page.

export const VISITOR_RANGES = [7, 30, 90] as const;
export type VisitorRange = (typeof VISITOR_RANGES)[number];
/** How many visits a page shows, and how many when the address does not say. */
export const VISITOR_PAGE_SIZES = [25, 50, 100] as const;
export type VisitorPageSize = (typeof VISITOR_PAGE_SIZES)[number];
export const VISITORS_PAGE_SIZE: VisitorPageSize = 50;

export type TrafficSource = 'direct' | 'search' | 'social' | 'internal' | 'referral';

export const sourceLabels: Record<TrafficSource, string> = {
  direct: 'Direct',
  search: 'Organic search',
  social: 'Social',
  internal: 'Internal',
  referral: 'Referral',
};

/** One visit: the pages someone viewed in a session, from first to last. */
export type VisitorSession = {
  id: string;
  /** When the last page was viewed, ms. */
  lastView: number;
  views: number;
  entry: { path: string; title: string };
  exit: { path: string; title: string };
  /** The site they came from, or null when they typed the address or used a bookmark. */
  referrer: string | null;
  source: TrafficSource;
  /** ISO 3166 two-letter code, from the visitor's network; no IP address is kept here. */
  country: string | null;
  countryName: string | null;
  city: string | null;
  os: string | null;
  browser: string | null;
  device: 'desktop' | 'mobile' | 'tablet' | null;
};

const SEARCH =
  /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|startpage|qwant)\.|search\.brave\.com$/;
const SOCIAL =
  /(^|\.)(facebook|fb|instagram|linkedin|lnkd|twitter|x|t|pinterest|reddit|youtube|tiktok|threads)\.(com|co|in|net|me)$/;
const OWN = /(^|\.)livinglegacy\.com\.au$/;

/** Where a visit came from, from PostHog's referring domain ("$direct" when there was none). */
export function trafficSource(referringDomain: string | null | undefined): {
  referrer: string | null;
  source: TrafficSource;
} {
  const domain = (referringDomain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (!domain || domain === '$direct') return { referrer: null, source: 'direct' };
  if (OWN.test(domain)) return { referrer: domain, source: 'internal' };
  if (SEARCH.test(domain)) return { referrer: domain, source: 'search' };
  if (SOCIAL.test(domain)) return { referrer: domain, source: 'social' };
  return { referrer: domain, source: 'referral' };
}

/** PostHog's device type ("Desktop", "Mobile", "Tablet") in the page's terms. */
export function deviceKind(type: string | null | undefined): VisitorSession['device'] {
  const t = (type ?? '').toLowerCase();
  return t === 'desktop' || t === 'mobile' || t === 'tablet' ? t : null;
}

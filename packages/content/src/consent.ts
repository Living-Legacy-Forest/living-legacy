// A visitor's cookie choice, kept in one first-party cookie. Pure functions, so the website
// reads and writes it in the browser and the rules are tested here without one.

export const CONSENT_COOKIE = 'll_consent';

/** Raise this when the categories change meaning, so everyone is asked again. */
export const CONSENT_VERSION = 1;

/** A choice lasts a year by default, then the visitor is asked again. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** How long a choice may last, in months (Settings, Cookies & privacy). */
export const CONSENT_MONTHS_OPTIONS = [3, 6, 12] as const;
export const DEFAULT_CONSENT_MONTHS = 12;

/** A choice's lifetime in seconds. Anything not on the list is a year, never longer. */
export function consentMaxAge(months: number): number {
  return (CONSENT_MONTHS_OPTIONS as readonly number[]).includes(months)
    ? Math.round((CONSENT_MAX_AGE_SECONDS * months) / 12)
    : CONSENT_MAX_AGE_SECONDS;
}

/** The banner's words until an editor changes them (Settings, Cookies & privacy). */
export const CONSENT_COPY_DEFAULTS = {
  cookieTitle: 'Your cookie choices',
  cookieMessage:
    'We use cookies to see how people use this site and to measure our advertising. Essential cookies are always on. The rest are your choice, and you can change it any time from Cookie settings at the bottom of any page.',
  cookieAnalyticsText:
    'Shows us which pages help and where things go wrong. Google Analytics and PostHog.',
  cookieMarketingText:
    'Measures our advertising and lets us show our ads to people who have visited. Google Ads, Google Tag Manager and Meta.',
};

/** Essential cookies are always on and not a choice, so they have no category. */
export const CONSENT_CATEGORIES = ['analytics', 'marketing'] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export type ConsentChoice = Record<ConsentCategory, boolean>;

/** What is stored: the choice, when it was made, and which wording it answered. */
export type ConsentRecord = ConsentChoice & { v: number; at: number };

export const ACCEPT_ALL: ConsentChoice = { analytics: true, marketing: true };
export const REJECT_ALL: ConsentChoice = { analytics: false, marketing: false };

/** The cookie value for a choice made at `now` (ms). */
export function serialiseConsent(choice: ConsentChoice, now: number): string {
  const record: ConsentRecord = {
    v: CONSENT_VERSION,
    analytics: choice.analytics,
    marketing: choice.marketing,
    at: now,
  };
  return encodeURIComponent(JSON.stringify(record));
}

/**
 * The string to assign to `document.cookie`. Lax, so it is sent on the visitor's own
 * navigation; Secure on https so it never travels in the clear.
 */
export function consentCookie(
  choice: ConsentChoice,
  now: number,
  secure: boolean,
  months: number = DEFAULT_CONSENT_MONTHS
): string {
  return [
    `${CONSENT_COOKIE}=${serialiseConsent(choice, now)}`,
    'Path=/',
    `Max-Age=${consentMaxAge(months)}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/**
 * The visitor's choice from a `document.cookie` string, or null when there is none worth
 * trusting: missing, malformed, from older wording, or older than `months`. Null means ask.
 */
export function parseConsent(
  cookieString: string,
  now: number,
  months: number = DEFAULT_CONSENT_MONTHS
): ConsentRecord | null {
  const prefix = `${CONSENT_COOKIE}=`;
  // Match the whole name, so a cookie that merely ends in `ll_consent` is not read.
  const part = cookieString
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(prefix));
  if (!part) return null;

  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(part.slice(prefix.length)));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const { v, analytics, marketing, at } = value as Record<string, unknown>;
  if (v !== CONSENT_VERSION) return null;
  if (typeof analytics !== 'boolean' || typeof marketing !== 'boolean') return null;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  // A time in the future is as untrustworthy as one too far back.
  if (at > now || now - at > consentMaxAge(months) * 1000) return null;

  return { v, analytics, marketing, at };
}

/** True only when the visitor has chosen, and chose yes for this category. */
export function allows(record: ConsentRecord | null, category: ConsentCategory): boolean {
  return record?.[category] === true;
}

/**
 * The categories a change takes back a yes from, so what they already set must go. `activated`
 * are the categories whose tags this page has started. They count even when `before` says no:
 * with two tabs open, the other tab may already have rejected, and this page's tags are still
 * running.
 */
export function withdrawnCategories(
  before: ConsentRecord | null,
  after: ConsentChoice,
  activated: readonly ConsentCategory[] = []
): ConsentCategory[] {
  return CONSENT_CATEGORIES.filter(
    (category) => (allows(before, category) || activated.includes(category)) && !after[category]
  );
}

/** The started categories the saved choice no longer allows, for a page that missed the change. */
export function lapsedCategories(
  activated: readonly ConsentCategory[],
  current: ConsentRecord | null
): ConsentCategory[] {
  return activated.filter((category) => !allows(current, category));
}

/** Whether going from `before` to `after` takes back any yes. */
export function withdrawsConsent(before: ConsentRecord | null, after: ConsentChoice): boolean {
  return withdrawnCategories(before, after).length > 0;
}

/**
 * The cookies each category's tags set. Taking back a yes deletes these, as the tags would
 * otherwise leave their visitor ids behind. Add a pattern here when a new tag goes on the site.
 */
export const TRACKING_COOKIES: Record<ConsentCategory, RegExp[]> = {
  // PostHog, then Google Analytics (including its per-property `_ga_<id>`).
  analytics: [/^ph_.+_posthog$/, /^_ga(_.+)?$/, /^_gid$/, /^_gat(_.+)?$/],
  // The Meta pixel, then Google's ad cookies, which Tag Manager and gtag.js set.
  marketing: [/^_fbp$/, /^_fbc$/, /^_gcl_.+$/, /^_gac_.+$/],
};

/** Whether a cookie (or PostHog's matching storage key) is one of these categories' tags'. */
export function isTrackingName(name: string, categories: readonly ConsentCategory[]): boolean {
  return categories.some((category) =>
    TRACKING_COOKIES[category].some((pattern) => pattern.test(name))
  );
}

/** The names in a `document.cookie` string that belong to these categories' tags. */
export function trackingCookiesToClear(
  cookieString: string,
  categories: readonly ConsentCategory[]
): string[] {
  return cookieString
    .split(';')
    .map((part) => part.split('=')[0]!.trim())
    .filter((name) => name && isTrackingName(name, categories));
}

// Site-wide settings, edited on the CMS Settings page and read by the website
// (footer, contact page, form fallbacks, page titles and search defaults).
// Stored as one JSON row in `site_settings`; these defaults fill any key the
// row lacks, so a field added later never reads as undefined.

export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

export const locales = ['en-AU', 'en-US', 'en-GB'] as const;
export type Locale = (typeof locales)[number];

/** Where the organisation operates from, for scheduling posts/announcements and the dashboard. */
export const timeZones = [
  'Australia/Perth',
  'Australia/Darwin',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Hobart',
] as const;
export type TimeZone = (typeof timeZones)[number];

/** How many idle days sign a CMS user out. */
export const sessionDayOptions = [1, 7, 30] as const;

/** Placeholders the title pattern may use. */
export const TITLE_TOKENS = { page: '{page}', site: '{site}' } as const;

export const SITE_SETTINGS_DEFAULTS = {
  siteTitle: 'Living Legacy',
  tagline: '',
  contactEmail: '',
  // Contact and business details, for the website footer and contact page.
  phone: '',
  address: '',
  openingHours: '',
  legalName: '',
  abn: '',
  facebookUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  linkedinUrl: '',
  tiktokUrl: '',
  googleBusinessUrl: '',
  titlePattern: `${TITLE_TOKENS.page} | ${TITLE_TOKENS.site}`,
  seoDescription: '',
  seoImageUrl: '',
  googleVerification: '',
  bingVerification: '',
  /** Ask search engines to leave the whole website out of their results. */
  hideFromSearch: false,
  // What the content score measures blog posts against (Settings, Content targets).
  targetWordsMin: 600,
  targetWordsMax: 2000,
  targetHeadingsMin: 3,
  targetHeadingsMax: 12,
  targetParagraphsMin: 5,
  targetImagesMin: 1,
  targetImagesMax: 8,
  targetFocusKeywordUses: 2,
  targetRelatedTermUses: 1,
  // CMS sign-in.
  /** Comma-separated; invites go only to these domains. Empty allows any. */
  allowedEmailDomains: '',
  googleSignIn: true,
  /** Idle days before a CMS session ends; one of sessionDayOptions. */
  sessionDays: 7,
  locale: 'en-AU' as Locale,
  theme: 'system' as Theme,
  timeZone: 'Australia/Melbourne' as TimeZone,
};

export type SiteSettings = typeof SITE_SETTINGS_DEFAULTS;

/** A stored row over the defaults. Keys this version does not know, or of the wrong type, are dropped. */
export function parseSiteSettings(data: unknown): SiteSettings {
  const stored = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const settings = { ...SITE_SETTINGS_DEFAULTS };
  for (const key of Object.keys(settings) as (keyof SiteSettings)[]) {
    const value = stored[key];
    if (typeof value === typeof settings[key]) Object.assign(settings, { [key]: value });
  }
  return settings;
}

export const CONTENT_TARGET_KEYS = [
  'targetWordsMin',
  'targetWordsMax',
  'targetHeadingsMin',
  'targetHeadingsMax',
  'targetParagraphsMin',
  'targetImagesMin',
  'targetImagesMax',
  'targetFocusKeywordUses',
  'targetRelatedTermUses',
] as const satisfies readonly (keyof SiteSettings)[];

export type ContentTargets = Pick<SiteSettings, (typeof CONTENT_TARGET_KEYS)[number]>;

export function contentTargetsFrom(settings: SiteSettings): ContentTargets {
  return Object.fromEntries(
    CONTENT_TARGET_KEYS.map((key) => [key, settings[key]])
  ) as ContentTargets;
}

const TARGET_RANGES = [
  ['targetWordsMin', 'targetWordsMax', 'Words'],
  ['targetHeadingsMin', 'targetHeadingsMax', 'Headings'],
  ['targetImagesMin', 'targetImagesMax', 'Images'],
] as const;

/** A sentence naming the first range whose minimum is above its maximum. */
export function contentTargetProblem(targets: ContentTargets): string | null {
  for (const [min, max, label] of TARGET_RANGES) {
    if (targets[min] > targets[max]) return `${label}: the lowest target is above the highest.`;
  }
  return null;
}

/** "{page} | {site}" with "Contact" → "Contact | Living Legacy". No page title gives the site title alone. */
export function formatPageTitle(pattern: string, page: string, site: string): string {
  if (!page) return site;
  return (pattern || SITE_SETTINGS_DEFAULTS.titlePattern)
    .replaceAll(TITLE_TOKENS.page, page)
    .replaceAll(TITLE_TOKENS.site, site)
    .trim();
}

/** "03 7019 6142" → "tel:0370196142", keeping a leading + for international numbers. */
export function telHref(phone: string): string {
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${phone.replace(/\D/g, '')}`;
}

/** "Living-Legacy.com.au, @sistercreatives.co" → ["living-legacy.com.au", "sistercreatives.co"]. */
export function parseEmailDomains(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean)
    ),
  ];
}

/** A bare domain such as "example.com.au": labels of letters, digits and hyphens. */
export function isEmailDomain(domain: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}

/** Whether an address may be invited. An empty list allows any domain. */
export function isEmailDomainAllowed(email: string, allowed: string): boolean {
  const domains = parseEmailDomains(allowed);
  if (domains.length === 0) return true;
  const domain = email.trim().toLowerCase().split('@').pop() ?? '';
  return domains.includes(domain);
}

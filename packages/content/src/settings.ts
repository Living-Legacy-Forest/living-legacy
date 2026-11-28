// Site-wide settings, edited on the CMS Settings page and read by the website
// (footer, contact page, form fallbacks, page titles and search defaults).
// Stored as one JSON row in `site_settings`; these defaults fill any key the
// row lacks, so a field added later never reads as undefined.
import { BRAND_RULES, type BrandRule, parseBrandRules } from './brand-language';
import { CONSENT_COPY_DEFAULTS, CONSENT_MONTHS_OPTIONS, DEFAULT_CONSENT_MONTHS } from './consent';

export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

/** The typefaces the CMS can use (Settings, Language & appearance). The website keeps its own. */
export const cmsFonts = [
  'inter',
  'geist',
  'ibm-plex-sans',
  'atkinson',
  'montserrat',
  'system',
] as const;
export type CmsFont = (typeof cmsFonts)[number];

/** The CMS colour palettes, in light and dark alike. Neutral is the plain greys. */
export const cmsColours = ['neutral', 'stone', 'forest', 'ocean', 'clay'] as const;
export type CmsColour = (typeof cmsColours)[number];

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

/** The day weeks start on in the CMS's calendars and date pickers: 1 Monday, 0 Sunday. */
export const weekStarts = [1, 0] as const;
export type WeekStart = (typeof weekStarts)[number];

/** How the CMS writes a date: "28 Nov 2026", "28/11/2026" or "2026-11-28". */
export const dateFormats = ['short', 'numeric', 'iso'] as const;
export type DateFormat = (typeof dateFormats)[number];

/** How the CMS writes a time of day: "1:05 pm" or "13:05". */
export const timeFormats = ['12', '24'] as const;
export type TimeFormat = (typeof timeFormats)[number];

/** Where the CMS opens when someone signs in. Anyone who cannot open the page gets the dashboard. */
export const homePages = [
  'dashboard',
  'posts',
  'calendar',
  'events',
  'media',
  'analytics',
] as const;
export type HomePage = (typeof homePages)[number];

/** How many idle days sign a CMS user out. */
export const sessionDayOptions = [1, 7, 30] as const;

/** Placeholders the title pattern may use. */
export const TITLE_TOKENS = { page: '{page}', site: '{site}' } as const;

/** The most suggestions one person may be allowed a day (Settings, Writing assistant). */
export const AI_DAILY_LIMIT_MAX = 1000;

/** The kinds of suggestion an admin can switch on or off (Settings, Writing assistant). */
export const AI_GROUPS = ['searchText', 'summaries', 'tags', 'imageText', 'brandFixes'] as const;
export type AiGroup = (typeof AI_GROUPS)[number];

/** The longest note an admin may add to the assistant's instructions. */
export const AI_INSTRUCTIONS_MAX = 500;

export const SITE_SETTINGS_DEFAULTS = {
  siteTitle: 'Living Legacy',
  tagline: '',
  contactEmail: '',
  // Contact and business details, for the website footer and contact page.
  phone: '',
  address: '',
  openingHours: '',
  legalName: '',
  /** The name the business trades under, when it is not the legal one. */
  tradingName: '',
  abn: '',
  acn: '',
  /** Where post goes, when that is not the street address. */
  postalAddress: '',
  /** A number for out of hours, shown on the contact page. */
  afterHoursPhone: '',
  /** For journalists, shown on the contact page. */
  mediaEmail: '',
  /** Where a guest's reply to a booking confirmation goes. */
  bookingsEmail: '',
  facebookUrl: '',
  instagramUrl: '',
  xUrl: '',
  youtubeUrl: '',
  linkedinUrl: '',
  tiktokUrl: '',
  googleBusinessUrl: '',
  titlePattern: `${TITLE_TOKENS.page} | ${TITLE_TOKENS.site}`,
  seoDescription: '',
  /** Media library image for shares and search results; wins over `seoImageUrl`. */
  seoImageMediaId: '',
  /** A link typed in before the library could be used; still shown until replaced. */
  seoImageUrl: '',
  /** What the share image shows, for people who cannot see it. */
  seoImageAlt: '',
  /** Media library image for browser tabs and home screens; '' uses the built-in icons. */
  siteIconMediaId: '',
  /** Shown instead of the site icon when the browser is in dark mode; '' uses the site icon. */
  siteIconDarkMediaId: '',
  googleVerification: '',
  bingVerification: '',
  facebookVerification: '',
  pinterestVerification: '',
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
  // The search listing and readability checks. Characters for the first four, words for the rest.
  targetTitleMin: 30,
  targetTitleMax: 60,
  targetDescriptionMin: 70,
  targetDescriptionMax: 160,
  /** The most words a sentence may average. */
  targetSentenceWords: 20,
  /** The most words one paragraph may have. */
  targetParagraphWordsMax: 150,
  /** The most characters a permalink may have. */
  targetSlugMax: 60,
  targetFocusKeywordUses: 2,
  targetRelatedTermUses: 1,
  // What the brand language check looks at (Settings, Brand language).
  brandFlagDashes: true,
  brandFlagExclamations: true,
  brandCheckImageAlts: true,
  brandCheckSearchListing: true,
  /** The words the content score flags (Settings, Brand language). Starts as the guide's list. */
  brandRules: [...BRAND_RULES] as BrandRule[],
  // The writing assistant (Settings, Writing assistant): the Suggest buttons, and how many each
  // person may ask for in a day.
  aiEnabled: true,
  aiDailyLimit: 100,
  /** Which kinds of suggestion are on. */
  aiSearchText: true,
  aiSummaries: true,
  aiTags: true,
  aiImageText: true,
  aiBrandFixes: true,
  /** A note added to every suggestion's instructions. The brand guide still wins. */
  aiInstructions: '',
  /** Email guests a confirmation, with a link to cancel, when they book on the website. */
  sendBookingConfirmations: true,
  // Cookies & privacy: which tags the website loads, and the banner that asks first. A tag id left
  // empty falls back to the one the site was built with.
  gtmId: '',
  metaPixelId: '',
  /** Comma-separated: Google Analytics and Google Ads share one loader. */
  gaMeasurementIds: '',
  posthogKey: '',
  /** Months a visitor's cookie choice lasts; one of CONSENT_MONTHS_OPTIONS. */
  consentMonths: DEFAULT_CONSENT_MONTHS as number,
  ...CONSENT_COPY_DEFAULTS,
  // CMS sign-in.
  /** Comma-separated; invites go only to these domains. Empty allows any. */
  allowedEmailDomains: '',
  googleSignIn: true,
  /** Idle days before a CMS session ends; one of sessionDayOptions. */
  sessionDays: 7,
  locale: 'en-AU' as Locale,
  theme: 'system' as Theme,
  /** The CMS sidebar for anyone who has not chosen their own: 2 is a rail and pages, 1 a single list. */
  sidebarColumns: 2 as 1 | 2,
  cmsFont: 'inter' as CmsFont,
  cmsColour: 'neutral' as CmsColour,
  timeZone: 'Australia/Melbourne' as TimeZone,
  // Regional (Settings, General): how the CMS writes dates and times, and where it opens.
  weekStartsOn: 1 as WeekStart,
  dateFormat: 'short' as DateFormat,
  timeFormat: '12' as TimeFormat,
  homePage: 'dashboard' as HomePage,
};

export type SiteSettings = typeof SITE_SETTINGS_DEFAULTS;

/** A stored row over the defaults. Keys this version does not know, or of the wrong type, are dropped. */
/** The smallest side a site icon may have: phones ask for up to 512 pixels. */
export const SITE_ICON_MIN = 512;

/** Why an image cannot be the site icon (or `label`, for the dark one), or null when it can. */
export function siteIconProblem(
  size: { width: number | null; height: number | null },
  label = 'site icon'
) {
  const { width, height } = size;
  if (!width || !height) return 'That image could not be measured. Upload it again as a PNG.';
  if (width !== height) {
    return `The ${label} must be square. This image is ${width} by ${height} pixels.`;
  }
  if (width < SITE_ICON_MIN) {
    return `The ${label} must be at least ${SITE_ICON_MIN} by ${SITE_ICON_MIN} pixels. This image is ${width} by ${height}.`;
  }
  return null;
}

/**
 * A few lines that add the page's icon link themselves, showing `lightHref` and, while the
 * browser is in dark mode, `darkHref`, and following the browser if it changes. The link is the
 * script's own, not part of the markup: a framework that renders the page (React hoists and
 * re-creates icon links when it hydrates) would otherwise add a second link with the light icon
 * after this one was changed, and the browser would keep showing that. A `media` attribute on
 * two icon links would do this with no script, but browsers disagree on whether they honour it.
 * Pair it with a `<noscript>` holding the light icon.
 */
export function iconSchemeScript(lightHref: string, darkHref: string): string {
  // JSON.stringify keeps the quotes right; `<` is escaped so a value can never end the tag.
  const quote = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `(function(){try{var light=${quote(lightHref)},dark=${quote(darkHref)},m=matchMedia('(prefers-color-scheme: dark)'),l=document.createElement('link');l.rel='icon';document.head.appendChild(l);function s(){l.href=m.matches?dark:light}s();m.addEventListener('change',s)}catch(e){}})();`;
}

export function parseSiteSettings(data: unknown): SiteSettings {
  const stored = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const settings = { ...SITE_SETTINGS_DEFAULTS };
  for (const key of Object.keys(settings) as (keyof SiteSettings)[]) {
    const value = stored[key];
    if (typeof value === typeof settings[key]) Object.assign(settings, { [key]: value });
  }
  // A list needs more than a type check: an invalid one falls back to the defaults.
  if (settings.sidebarColumns !== 1 && settings.sidebarColumns !== 2) {
    settings.sidebarColumns = SITE_SETTINGS_DEFAULTS.sidebarColumns;
  }
  if (!(weekStarts as readonly number[]).includes(settings.weekStartsOn)) {
    settings.weekStartsOn = SITE_SETTINGS_DEFAULTS.weekStartsOn;
  }
  if (!(dateFormats as readonly string[]).includes(settings.dateFormat)) {
    settings.dateFormat = SITE_SETTINGS_DEFAULTS.dateFormat;
  }
  if (!(timeFormats as readonly string[]).includes(settings.timeFormat)) {
    settings.timeFormat = SITE_SETTINGS_DEFAULTS.timeFormat;
  }
  if (!(homePages as readonly string[]).includes(settings.homePage)) {
    settings.homePage = SITE_SETTINGS_DEFAULTS.homePage;
  }
  if (!(cmsFonts as readonly string[]).includes(settings.cmsFont)) {
    settings.cmsFont = SITE_SETTINGS_DEFAULTS.cmsFont;
  }
  if (!(cmsColours as readonly string[]).includes(settings.cmsColour)) {
    settings.cmsColour = SITE_SETTINGS_DEFAULTS.cmsColour;
  }
  if (
    !Number.isInteger(settings.aiDailyLimit) ||
    settings.aiDailyLimit < 1 ||
    settings.aiDailyLimit > AI_DAILY_LIMIT_MAX
  ) {
    settings.aiDailyLimit = SITE_SETTINGS_DEFAULTS.aiDailyLimit;
  }
  if (!(CONSENT_MONTHS_OPTIONS as readonly number[]).includes(settings.consentMonths)) {
    settings.consentMonths = SITE_SETTINGS_DEFAULTS.consentMonths;
  }
  // Banner words are never blank: a banner with no message asks nothing.
  for (const key of Object.keys(CONSENT_COPY_DEFAULTS) as (keyof typeof CONSENT_COPY_DEFAULTS)[]) {
    if (!settings[key].trim()) settings[key] = CONSENT_COPY_DEFAULTS[key];
  }
  settings.brandRules = parseBrandRules(stored.brandRules) ?? SITE_SETTINGS_DEFAULTS.brandRules;
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
  'targetTitleMin',
  'targetTitleMax',
  'targetDescriptionMin',
  'targetDescriptionMax',
  'targetSentenceWords',
  'targetParagraphWordsMax',
  'targetSlugMax',
  'targetFocusKeywordUses',
  'targetRelatedTermUses',
  'brandFlagDashes',
  'brandFlagExclamations',
  'brandCheckImageAlts',
  'brandCheckSearchListing',
  'brandRules',
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
  ['targetTitleMin', 'targetTitleMax', 'Search title'],
  ['targetDescriptionMin', 'targetDescriptionMax', 'Search description'],
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

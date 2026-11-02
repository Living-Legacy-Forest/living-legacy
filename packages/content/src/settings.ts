// Site-wide settings, edited on the CMS Settings page and read by the website
// (footer, contact page, form fallbacks, page titles and search defaults).
// Stored as one JSON row in `site_settings`; these defaults fill any key the
// row lacks, so a field added later never reads as undefined.

export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

export const locales = ['en-AU', 'en-US', 'en-GB'] as const;
export type Locale = (typeof locales)[number];

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
  locale: 'en-AU' as Locale,
  theme: 'system' as Theme,
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

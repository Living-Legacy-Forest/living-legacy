import {
  type Locale,
  SEO_DESCRIPTION_LIMIT,
  type SiteSettings,
  TITLE_TOKENS,
  type Theme,
  type TimeZone,
  can,
  formatAbn,
  isEmailDomain,
  isValidAbn,
  locales,
  parseEmailDomains,
  sessionDayOptions,
  themes,
  timeZones,
} from '@ll/content';
import { siteSettings } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';

export { TITLE_TOKENS, timeZones };
export type { Locale, SiteSettings, Theme, TimeZone };

export const getSiteSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => readSiteSettings());

/**
 * The settings every page needs, with no auth: the theme renders the right
 * colour scheme server-side before a session is known (e.g. login), and
 * scheduling UI needs the time zone everywhere.
 */
export const getRootSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const { theme, timeZone } = await readSiteSettings();
  return { theme, timeZone };
});

const text = (max: number) => z.string().trim().max(max).default('');
const link = text(300).refine(
  (v) => !v || /^https?:\/\/\S+$/.test(v),
  'Links must start with http:// or https://.'
);
/** Accepts the code alone or the whole <meta> tag the search engine hands out. */
const verification = text(300).transform((v) => /content="([^"]+)"/.exec(v)?.[1] ?? v);

const settingsSchema = z.object({
  siteTitle: z.string().trim().min(1).max(80),
  tagline: text(160),
  contactEmail: text(120),
  phone: text(40),
  address: text(300),
  openingHours: text(300),
  legalName: text(120),
  abn: text(20)
    .refine((v) => !v || isValidAbn(v), 'That ABN is not valid. Check the 11 digits.')
    .transform(formatAbn),
  facebookUrl: link,
  instagramUrl: link,
  youtubeUrl: link,
  linkedinUrl: link,
  tiktokUrl: link,
  googleBusinessUrl: link,
  titlePattern: text(120).refine(
    (v) => !v || v.includes(TITLE_TOKENS.page),
    `The title pattern needs ${TITLE_TOKENS.page} where the page's own title goes.`
  ),
  seoDescription: text(SEO_DESCRIPTION_LIMIT),
  seoImageUrl: link,
  googleVerification: verification,
  bingVerification: verification,
  hideFromSearch: z.boolean(),
  allowedEmailDomains: text(500)
    .refine(
      (v) => parseEmailDomains(v).every(isEmailDomain),
      'Enter domains such as example.com.au, separated by commas.'
    )
    .transform((v) => parseEmailDomains(v).join(', ')),
  googleSignIn: z.boolean(),
  sessionDays: z
    .number()
    .refine((n) => (sessionDayOptions as readonly number[]).includes(n), 'Pick 1, 7 or 30 days.'),
  locale: z.enum(locales),
  theme: z.enum(themes),
  timeZone: z.enum(timeZones),
});

/** The Search & sharing settings, which SEO people may change on their own. */
const SEO_KEYS = [
  'titlePattern',
  'seoDescription',
  'seoImageUrl',
  'googleVerification',
  'bingVerification',
  'hideFromSearch',
] as const satisfies readonly (keyof SiteSettings)[];

export const saveSiteSettings = createServerFn({ method: 'POST' })
  .middleware([requirePermission('seo:write')])
  .validator(settingsSchema)
  .handler(async ({ data, context }) => {
    // Without full settings access, only the search fields change.
    const value: SiteSettings = can(context.user.role, 'settings:write')
      ? data
      : {
          ...(await readSiteSettings()),
          ...Object.fromEntries(SEO_KEYS.map((key) => [key, data[key]])),
        };
    const db = getDb();
    await db
      .insert(siteSettings)
      .values({ id: 'site', data: value, updatedBy: context.user.id })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: { data: value, updatedBy: context.user.id, updatedAt: new Date() },
      });
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'settings.updated',
      summary: 'Updated site settings',
    });
    return value;
  });

import {
  CONTENT_TARGET_KEYS,
  type Locale,
  SEO_DESCRIPTION_LIMIT,
  type SiteSettings,
  TITLE_TOKENS,
  type CmsColour,
  type CmsFont,
  type Theme,
  type TimeZone,
  can,
  cmsColours,
  cmsFonts,
  AI_DAILY_LIMIT_MAX,
  brandRulesSchema,
  contentTargetProblem,
  formatAbn,
  isEmailDomain,
  isValidAbn,
  locales,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalWebUrlSchema,
  parseEmailDomains,
  sessionDayOptions,
  themes,
  timeZones,
  siteIconProblem,
} from '@ll/content';
import { media, siteSettings } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';

export { TITLE_TOKENS, cmsColours, cmsFonts, timeZones };
export type { CmsColour, CmsFont, Locale, SiteSettings, Theme, TimeZone };

export const getSiteSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => readSiteSettings());

/**
 * The settings every page needs, with no auth: the theme renders the right
 * colour scheme server-side before a session is known (e.g. login), and
 * scheduling UI needs the time zone everywhere. A signed-in person's own
 * theme (Profile, Appearance) wins over the site's.
 */
export const getRootSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ theme: siteTheme, cmsFont, cmsColour, timeZone, siteIconMediaId }, personal] =
    await Promise.all([readSiteSettings(), personalTheme()]);
  return {
    theme: personal ?? siteTheme,
    siteTheme,
    personalTheme: personal,
    cmsFont,
    cmsColour,
    timeZone,
    siteIconMediaId,
  };
});

/** The signed-in person's theme, read fresh so a change shows on the next load. */
async function personalTheme(): Promise<Theme | null> {
  try {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
      query: { disableCookieCache: true },
    });
    const value = (session?.user as { theme?: unknown } | undefined)?.theme;
    return (themes as readonly unknown[]).includes(value) ? (value as Theme) : null;
  } catch {
    return null;
  }
}

const text = (max: number) => z.string().trim().max(max).default('');
const link = optionalWebUrlSchema(300);
/** Accepts the code alone or the whole <meta> tag the search engine hands out. */
const verification = text(300).transform((v) => /content="([^"]+)"/.exec(v)?.[1] ?? v);

const target = z.number().int('Targets are whole numbers.').min(0).max(100_000);

const settingsSchema = z
  .object({
    siteTitle: z.string().trim().min(1).max(80),
    tagline: text(160),
    contactEmail: optionalEmailSchema(120),
    phone: optionalPhoneSchema(),
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
    siteIconMediaId: z.string().max(64),
    googleVerification: verification,
    bingVerification: verification,
    hideFromSearch: z.boolean(),
    targetWordsMin: target,
    targetWordsMax: target,
    targetHeadingsMin: target,
    targetHeadingsMax: target,
    targetParagraphsMin: target,
    targetImagesMin: target,
    targetImagesMax: target,
    targetFocusKeywordUses: target,
    targetRelatedTermUses: target,
    brandRules: brandRulesSchema,
    allowedEmailDomains: text(500)
      .refine(
        (v) => parseEmailDomains(v).every(isEmailDomain),
        'Enter domains such as example.com.au, separated by commas.'
      )
      .transform((v) => parseEmailDomains(v).join(', ')),
    aiEnabled: z.boolean(),
    aiDailyLimit: z
      .number()
      .int(`Enter a whole number from 1 to ${AI_DAILY_LIMIT_MAX}.`)
      .min(1, `Enter a whole number from 1 to ${AI_DAILY_LIMIT_MAX}.`)
      .max(AI_DAILY_LIMIT_MAX, `Enter a whole number from 1 to ${AI_DAILY_LIMIT_MAX}.`),
    googleSignIn: z.boolean(),
    sessionDays: z
      .number()
      .refine((n) => (sessionDayOptions as readonly number[]).includes(n), 'Pick 1, 7 or 30 days.'),
    locale: z.enum(locales),
    theme: z.enum(themes),
    cmsFont: z.enum(cmsFonts),
    cmsColour: z.enum(cmsColours),
    timeZone: z.enum(timeZones),
  })
  .superRefine((value, ctx) => {
    const problem = contentTargetProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** The Search & sharing settings, which SEO people may change on their own. */
const SEO_KEYS = [
  'titlePattern',
  'seoDescription',
  'seoImageUrl',
  'googleVerification',
  'bingVerification',
  'hideFromSearch',
  ...CONTENT_TARGET_KEYS,
] as const satisfies readonly (keyof SiteSettings)[];

export const saveSiteSettings = createServerFn({ method: 'POST' })
  .middleware([requirePermission('seo:write')])
  .validator(settingsSchema)
  .handler(async ({ data, context }) => {
    // Without full settings access, only the search fields change.
    const value: SiteSettings = can(context.user, 'settings:write')
      ? data
      : {
          ...(await readSiteSettings()),
          ...Object.fromEntries(SEO_KEYS.map((key) => [key, data[key]])),
        };
    const db = getDb();
    if (value.siteIconMediaId) {
      const icon = await db.query.media.findFirst({ where: eq(media.id, value.siteIconMediaId) });
      if (!icon) throw new Error('That site icon is no longer in the media library.');
      const problem = siteIconProblem(icon);
      if (problem) throw new Error(problem);
    }
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

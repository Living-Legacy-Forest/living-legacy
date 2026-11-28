import {
  type Appearance,
  DEFAULT_APPEARANCE,
  parseAppearance,
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
  AI_INSTRUCTIONS_MAX,
  dateFormats,
  homePages,
  timeFormats,
  brandRulesSchema,
  contentTargetProblem,
  formatAbn,
  formatAcn,
  isEmailDomain,
  isValidAbn,
  isValidAcn,
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
import { CONSENT_MONTHS_OPTIONS } from '@ll/content/consent';
import { media } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { readSiteSettings, writeSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';
import { keepIntegrationSettings, saveBookingConfirmations } from './settings-store';

export { TITLE_TOKENS, cmsColours, cmsFonts, timeZones };
export type { CmsColour, CmsFont, Locale, SiteSettings, Theme, TimeZone };

export const getSiteSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => readSiteSettings());

/**
 * The settings every page needs, with no auth: the theme renders the right
 * colour scheme server-side before a session is known (e.g. login), and
 * scheduling UI needs the time zone everywhere. A signed-in person's own
 * theme (Profile, Appearance) and own colour and grain (the sidebar's Appearance
 * picker) win over the site's.
 */
export const getRootSettings = createServerFn({ method: 'GET' }).handler(async () => {
  const [
    {
      theme: siteTheme,
      sidebarColumns,
      cmsFont,
      cmsColour,
      timeZone,
      weekStartsOn,
      dateFormat,
      timeFormat,
      homePage,
      siteIconMediaId,
      siteIconDarkMediaId,
    },
    personal,
  ] = await Promise.all([readSiteSettings(), personalChoices()]);
  return {
    theme: personal.theme ?? siteTheme,
    siteTheme,
    personalTheme: personal.theme,
    sidebarColumns,
    appearance: personal.appearance,
    cmsFont,
    cmsColour,
    timeZone,
    weekStartsOn,
    dateFormat,
    timeFormat,
    homePage,
    siteIconMediaId,
    siteIconDarkMediaId,
  };
});

/** The signed-in person's theme and appearance, read fresh so a change shows on the next load. */
async function personalChoices(): Promise<{ theme: Theme | null; appearance: Appearance }> {
  try {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
      query: { disableCookieCache: true },
    });
    const person = session?.user as { theme?: unknown; appearance?: unknown } | undefined;
    const theme = (themes as readonly unknown[]).includes(person?.theme)
      ? (person?.theme as Theme)
      : null;
    return { theme, appearance: parseAppearance(person?.appearance) };
  } catch {
    return { theme: null, appearance: DEFAULT_APPEARANCE };
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
    tradingName: text(120),
    postalAddress: text(300),
    afterHoursPhone: optionalPhoneSchema(),
    mediaEmail: optionalEmailSchema(120),
    bookingsEmail: optionalEmailSchema(120),
    acn: text(20)
      .refine((v) => !v || isValidAcn(v), 'That ACN is not valid. Check the 9 digits.')
      .transform(formatAcn),
    abn: text(20)
      .refine((v) => !v || isValidAbn(v), 'That ABN is not valid. Check the 11 digits.')
      .transform(formatAbn),
    facebookUrl: link,
    instagramUrl: link,
    xUrl: link,
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
    seoImageMediaId: z.string().max(64),
    siteIconMediaId: z.string().max(64),
    siteIconDarkMediaId: z.string().max(64),
    googleVerification: verification,
    bingVerification: verification,
    facebookVerification: verification,
    pinterestVerification: verification,
    seoImageAlt: text(200),
    hideFromSearch: z.boolean(),
    targetWordsMin: target,
    targetWordsMax: target,
    targetHeadingsMin: target,
    targetHeadingsMax: target,
    targetParagraphsMin: target,
    targetImagesMin: target,
    targetImagesMax: target,
    targetTitleMin: target,
    targetTitleMax: target,
    targetDescriptionMin: target,
    targetDescriptionMax: target,
    targetSentenceWords: target,
    targetParagraphWordsMax: target,
    targetSlugMax: target,
    brandFlagDashes: z.boolean(),
    brandFlagExclamations: z.boolean(),
    brandCheckImageAlts: z.boolean(),
    brandCheckSearchListing: z.boolean(),
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
    aiSearchText: z.boolean(),
    aiSummaries: z.boolean(),
    aiTags: z.boolean(),
    aiImageText: z.boolean(),
    aiBrandFixes: z.boolean(),
    aiInstructions: text(AI_INSTRUCTIONS_MAX),
    sendBookingConfirmations: z.boolean(),
    consentMonths: z
      .number()
      .refine(
        (n) => (CONSENT_MONTHS_OPTIONS as readonly number[]).includes(n),
        'Pick 3, 6 or 12 months.'
      ),
    cookieTitle: z.string().trim().min(1, 'The cookie banner needs a heading.').max(80),
    cookieMessage: z.string().trim().min(1, 'The cookie banner needs a message.').max(600),
    cookieAnalyticsText: z.string().trim().min(1, 'Describe the analytics cookies.').max(300),
    cookieMarketingText: z.string().trim().min(1, 'Describe the marketing cookies.').max(300),
    googleSignIn: z.boolean(),
    sessionDays: z
      .number()
      .refine((n) => (sessionDayOptions as readonly number[]).includes(n), 'Pick 1, 7 or 30 days.'),
    locale: z.enum(locales),
    theme: z.enum(themes),
    sidebarColumns: z.union([z.literal(1), z.literal(2)]),
    cmsFont: z.enum(cmsFonts),
    cmsColour: z.enum(cmsColours),
    timeZone: z.enum(timeZones),
    weekStartsOn: z.union([z.literal(1), z.literal(0)]),
    dateFormat: z.enum(dateFormats),
    timeFormat: z.enum(timeFormats),
    homePage: z.enum(homePages),
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
  'seoImageMediaId',
  'googleVerification',
  'bingVerification',
  'facebookVerification',
  'pinterestVerification',
  'seoImageAlt',
  'hideFromSearch',
  ...CONTENT_TARGET_KEYS,
] as const satisfies readonly (keyof SiteSettings)[];

export const saveSiteSettings = createServerFn({ method: 'POST' })
  .middleware([requirePermission('seo:write')])
  .validator(settingsSchema)
  .handler(async ({ data, context }) => {
    // Without full settings access, only the search fields change. The tag ids and the booking
    // confirmations switch are edited on the Integrations page, so whatever this form held for them
    // (it may be a stale copy) is ignored.
    const existing = await readSiteSettings();
    const value: SiteSettings = can(context.user, 'settings:write')
      ? keepIntegrationSettings(existing, data)
      : {
          ...existing,
          ...Object.fromEntries(SEO_KEYS.map((key) => [key, data[key]])),
        };
    const db = getDb();
    for (const [id, label] of [
      [value.siteIconMediaId, 'site icon'],
      [value.siteIconDarkMediaId, 'dark mode icon'],
    ] as const) {
      if (!id) continue;
      const icon = await db.query.media.findFirst({ where: eq(media.id, id) });
      if (!icon) throw new Error(`That ${label} is no longer in the media library.`);
      const problem = siteIconProblem(icon, label);
      if (problem) throw new Error(problem);
    }
    if (value.seoImageMediaId) {
      const image = await db.query.media.findFirst({
        where: eq(media.id, value.seoImageMediaId),
      });
      if (!image || image.deletedAt) {
        throw new Error('That share image is no longer in the media library.');
      }
      if (!image.mime.startsWith('image/')) throw new Error('The share image must be a picture.');
    }
    await writeSiteSettings(db, value, context.user.id);
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'settings.updated',
      summary: 'Updated site settings',
    });
    return value;
  });

/** The Integrations page's switch for the confirmation email sent to people who book online. */
export const setBookingConfirmations = createServerFn({ method: 'POST' })
  .middleware([requirePermission('settings:write')])
  .validator(z.object({ enabled: z.boolean() }))
  .handler(({ data, context }) => saveBookingConfirmations(getDb(), data.enabled, context.user));

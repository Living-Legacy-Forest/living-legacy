import { SEO_DESCRIPTION_LIMIT, can, formatAbn, isValidAbn } from '@llf/content';
import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { siteSettings } = schema;

export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

export const locales = ['en-AU', 'en-US', 'en-GB'] as const;
export type Locale = (typeof locales)[number];

/** Placeholders the title pattern may use. */
export const TITLE_TOKENS = { page: '{page}', site: '{site}' } as const;

const defaults = {
  siteTitle: 'Living Legacy Forest',
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

export type SiteSettings = typeof defaults;

async function readSiteSettings(): Promise<SiteSettings> {
  const row = await getDb().query.siteSettings.findFirst({
    where: eq(siteSettings.id, 'site'),
  });
  return { ...defaults, ...(row?.data as Partial<SiteSettings> | undefined) };
}

export const getSiteSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(() => readSiteSettings());

/**
 * Just the theme, with no auth: the root document needs it to render the
 * right colour scheme server-side, before a session is known (e.g. login).
 */
export const getSiteTheme = createServerFn({ method: 'GET' }).handler(async () => {
  const { theme } = await readSiteSettings();
  return theme;
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
  locale: z.enum(locales),
  theme: z.enum(themes),
});

/** The Search & sharing settings, which SEO people may change on their own. */
const SEO_KEYS = [
  'titlePattern',
  'seoDescription',
  'seoImageUrl',
  'googleVerification',
  'bingVerification',
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
    await getDb()
      .insert(siteSettings)
      .values({ id: 'site', data: value, updatedBy: context.user.id })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: { data: value, updatedBy: context.user.id, updatedAt: new Date() },
      });
    return value;
  });

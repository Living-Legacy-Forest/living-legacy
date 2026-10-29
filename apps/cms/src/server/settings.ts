import { SEO_DESCRIPTION_LIMIT } from '@llf/content';
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

const defaults = {
  siteTitle: 'Living Legacy Forest',
  tagline: '',
  contactEmail: '',
  facebookUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  seoDescription: '',
  seoImageUrl: '',
  locale: 'en-AU' as Locale,
  theme: 'system' as Theme,
};

export type SiteSettings = typeof defaults;

export const getSiteSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const row = await getDb().query.siteSettings.findFirst({
      where: eq(siteSettings.id, 'site'),
    });
    return { ...defaults, ...(row?.data as Partial<SiteSettings> | undefined) };
  });

const settingsSchema = z.object({
  siteTitle: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().max(120).optional(),
  facebookUrl: z.string().trim().max(300).optional(),
  instagramUrl: z.string().trim().max(300).optional(),
  youtubeUrl: z.string().trim().max(300).optional(),
  seoDescription: z.string().trim().max(SEO_DESCRIPTION_LIMIT).optional(),
  seoImageUrl: z.string().trim().max(300).optional(),
  locale: z.enum(locales),
  theme: z.enum(themes),
});

export const saveSiteSettings = createServerFn({ method: 'POST' })
  .middleware([requirePermission('settings:write')])
  .validator(settingsSchema)
  .handler(async ({ data, context }) => {
    const value: SiteSettings = {
      ...data,
      tagline: data.tagline ?? '',
      contactEmail: data.contactEmail ?? '',
      facebookUrl: data.facebookUrl ?? '',
      instagramUrl: data.instagramUrl ?? '',
      youtubeUrl: data.youtubeUrl ?? '',
      seoDescription: data.seoDescription ?? '',
      seoImageUrl: data.seoImageUrl ?? '',
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

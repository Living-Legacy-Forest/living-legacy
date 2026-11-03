/**
 * Site-wide settings, managed in the CMS (Settings page) and stored as one
 * JSON row in the shared D1 database: contact and business details, social
 * links, the page title pattern and the search defaults. Parsed by
 * parseSiteSettings from @ll/content, the same rule the CMS uses, so a key
 * the row lacks always reads as its default.
 */
import { type SiteSettings, parseSiteSettings } from '@ll/content';
import { env } from 'cloudflare:workers';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    first<T>(): Promise<T | null>;
  };
}

const db = (env as { DB?: D1 }).DB;

/** How long an isolate reuses the settings before reading them again. */
const CACHE_MS = 60_000;
let cache: { settings: SiteSettings; expires: number } | undefined;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!db) return parseSiteSettings(undefined);
  if (cache && cache.expires > Date.now()) return cache.settings;

  try {
    const row = await db
      .prepare("SELECT data FROM site_settings WHERE id = 'site'")
      .first<{ data: string }>();
    const settings = parseSiteSettings(row ? JSON.parse(row.data) : undefined);
    cache = { settings, expires: Date.now() + CACHE_MS };
    return settings;
  } catch (error) {
    // A database hiccup must not take the site down; serve the last known
    // settings, or the defaults, and try again on the next request.
    console.error('[settings] could not load', error);
    return cache?.settings ?? parseSiteSettings(undefined);
  }
}

const SOCIAL_LABELS = {
  facebookUrl: 'Facebook',
  instagramUrl: 'Instagram',
  youtubeUrl: 'YouTube',
  linkedinUrl: 'LinkedIn',
  tiktokUrl: 'TikTok',
  googleBusinessUrl: 'Google reviews',
} as const;

export type SocialKey = keyof typeof SOCIAL_LABELS;

/** The social profiles filled in on the Settings page, in display order. */
export function socialLinks(
  settings: SiteSettings
): { key: SocialKey; label: string; href: string }[] {
  return (Object.keys(SOCIAL_LABELS) as SocialKey[])
    .filter((key) => settings[key])
    .map((key) => ({ key, label: SOCIAL_LABELS[key], href: settings[key] }));
}

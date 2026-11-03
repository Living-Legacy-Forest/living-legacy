import { type SiteSettings, parseSiteSettings } from '@llf/content';
import { schema } from '@llf/db';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

const { siteSettings } = schema;

// No dependency on session/auth, unlike @/server/settings: email.ts (called
// from the auth plugin) needs this without creating an import cycle back to
// itself through session -> auth -> email.
export async function readSiteSettings(): Promise<SiteSettings> {
  const row = await getDb().query.siteSettings.findFirst({
    where: eq(siteSettings.id, 'site'),
  });
  return parseSiteSettings(row?.data);
}

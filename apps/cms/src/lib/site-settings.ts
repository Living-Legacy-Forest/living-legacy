import { type SiteSettings, parseSiteSettings } from '@ll/content';
import { siteSettings } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

type Db = ReturnType<typeof getDb>;

// No dependency on session/auth, unlike @/server/settings: email.ts (called
// from the auth plugin) needs this without creating an import cycle back to
// itself through session -> auth -> email.
export async function readSiteSettings(): Promise<SiteSettings> {
  const row = await getDb().query.siteSettings.findFirst({
    where: eq(siteSettings.id, 'site'),
  });
  return parseSiteSettings(row?.data);
}

/** Saves the settings row, creating it the first time. */
export async function writeSiteSettings(db: Db, value: SiteSettings, userId: string) {
  await db
    .insert(siteSettings)
    .values({ id: 'site', data: value, updatedBy: userId })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { data: value, updatedBy: userId, updatedAt: new Date() },
    });
}

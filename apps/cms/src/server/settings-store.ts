import { type SiteSettings, type TrackingIds, pickTrackingIds } from '@ll/content';
import type { Db } from '@ll/db';
import { readSiteSettings, writeSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';

/**
 * What the Settings form saves, less the settings the Integrations page owns. The form may hold a
 * stale copy of them (it was opened before they changed), so they come from what is saved.
 */
export function keepIntegrationSettings(
  existing: SiteSettings,
  form: Omit<SiteSettings, keyof TrackingIds>
): SiteSettings {
  return {
    ...form,
    ...pickTrackingIds(existing),
    sendBookingConfirmations: existing.sendBookingConfirmations,
  };
}

/** Turns the confirmation email to people who book on the website on or off. */
export async function saveBookingConfirmations(
  db: Db,
  enabled: boolean,
  actor: { id: string; name: string }
) {
  await writeSiteSettings(
    db,
    { ...(await readSiteSettings()), sendBookingConfirmations: enabled },
    actor.id
  );
  await logActivity(db, {
    actorId: actor.id,
    actorName: actor.name,
    action: 'settings.updated',
    summary: `Turned booking confirmations ${enabled ? 'on' : 'off'}`,
  });
  return enabled;
}

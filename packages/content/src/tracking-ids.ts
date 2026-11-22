// The ids of the tags the website loads, as an editor types them (Settings, Cookies & privacy).
// Checked here so a typo is caught on save, not found weeks later as a gap in the reports.
import type { SiteSettings } from './settings';

export const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;
export const META_PIXEL_ID = /^\d{8,20}$/;
/** PostHog's public project key, which is safe to put in a web page. */
export const POSTHOG_KEY = /^phc_[A-Za-z0-9]{20,}$/;
/** Google Analytics 4 (G-), Google Ads (AW-) and the older Universal Analytics (UA-) ids. */
export const GA_ID = /^(G|AW|UA)-[A-Z0-9-]{4,20}$/;

/** "G-ABC123, AW-123456" → ["G-ABC123", "AW-123456"]. Blanks and repeats are dropped. */
export function parseGaIds(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,\s]+/)
        .map((id) => id.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
}

/** A sentence naming what is wrong with the ids, or null when each one is fine or left blank. */
export function trackingIdsProblem(ids: {
  gtmId: string;
  metaPixelId: string;
  gaMeasurementIds: string;
  posthogKey: string;
}): string | null {
  if (ids.gtmId && !GTM_ID.test(ids.gtmId.trim())) {
    return 'The Tag Manager id looks like GTM-ABC1234.';
  }
  if (ids.metaPixelId && !META_PIXEL_ID.test(ids.metaPixelId.trim())) {
    return 'The Meta pixel id is a number of 8 to 20 digits.';
  }
  const bad = parseGaIds(ids.gaMeasurementIds).find((id) => !GA_ID.test(id));
  if (bad)
    return `"${bad}" is not a Google Analytics id. They look like G-ABC123XYZ or AW-123456789.`;
  if (ids.posthogKey && !POSTHOG_KEY.test(ids.posthogKey.trim())) {
    return 'The PostHog project key starts with phc_.';
  }
  return null;
}

/** The settings keys the Integrations page owns. Saving Settings leaves them as they are. */
export const TRACKING_ID_KEYS = ['gtmId', 'metaPixelId', 'gaMeasurementIds', 'posthogKey'] as const;

export type TrackingIds = Pick<SiteSettings, (typeof TRACKING_ID_KEYS)[number]>;

/** Just the tag ids from the settings. */
export function pickTrackingIds(settings: TrackingIds): TrackingIds {
  return {
    gtmId: settings.gtmId,
    metaPixelId: settings.metaPixelId,
    gaMeasurementIds: settings.gaMeasurementIds,
    posthogKey: settings.posthogKey,
  };
}

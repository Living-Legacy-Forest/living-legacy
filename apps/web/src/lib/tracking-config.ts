/**
 * Which tracking this site runs. The ids come from Settings in the CMS (Cookies & privacy); one
 * left empty there uses the id the site was built with (the PUBLIC_* variables), so a deploy that
 * forgets to move an id across does not quietly switch a tag off.
 *
 * One place, so the tags, the consent banner and the footer's Cookie settings link agree: a site
 * with nothing to consent to shows neither.
 */
import { parseGaIds } from '@ll/content';
import type { SiteSettings } from '@ll/content';

export interface TrackingConfig {
  gtmId: string | undefined;
  metaPixelId: string | undefined;
  posthogKey: string | undefined;
  gaIds: string[];
  /** Months a visitor's choice is kept. */
  consentMonths: number;
  /** Anything that sets cookies or sends visits elsewhere, so the visitor must be asked. */
  asksConsent: boolean;
}

export function trackingConfigFrom(settings: SiteSettings): TrackingConfig {
  const gtmId = settings.gtmId.trim() || import.meta.env.PUBLIC_GTM_ID || undefined;
  const metaPixelId =
    settings.metaPixelId.trim() || import.meta.env.PUBLIC_META_PIXEL_ID || undefined;
  const posthogKey = settings.posthogKey.trim() || import.meta.env.PUBLIC_POSTHOG_KEY || undefined;
  const gaIds = parseGaIds(
    settings.gaMeasurementIds || import.meta.env.PUBLIC_GA_MEASUREMENT_ID || ''
  );
  return {
    gtmId,
    metaPixelId,
    posthogKey,
    gaIds,
    consentMonths: settings.consentMonths,
    asksConsent: Boolean(gtmId || metaPixelId || posthogKey || gaIds.length > 0),
  };
}

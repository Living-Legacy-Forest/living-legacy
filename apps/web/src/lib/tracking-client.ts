/**
 * What the page tells its scripts about tracking. The ids can come from Settings, which only the
 * server sees, so the page writes the ones the browser needs into <meta> tags and scripts read
 * them here. Both are blank when the page wrote none.
 */
import { DEFAULT_CONSENT_MONTHS } from '@ll/content/consent';

const meta = (name: string) =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || undefined;

/** The PostHog project key for this page, or undefined when PostHog is not configured. */
export function posthogKey(): string | undefined {
  return typeof document === 'undefined' ? undefined : meta('ll-posthog-key');
}

/** How many months a cookie choice is kept. */
export function consentMonths(): number {
  if (typeof document === 'undefined') return DEFAULT_CONSENT_MONTHS;
  const months = Number(meta('ll-consent-months'));
  return Number.isFinite(months) && months > 0 ? months : DEFAULT_CONSENT_MONTHS;
}

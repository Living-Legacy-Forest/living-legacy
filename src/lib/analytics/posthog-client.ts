import posthog from 'posthog-js';
import type { CaptureResult } from 'posthog-js';

/**
 * Browser-side PostHog: product analytics + error tracking.
 *
 * Imported dynamically by `src/components/analytics/PostHog.astro` so the
 * bundle is only fetched when PUBLIC_POSTHOG_KEY is configured.
 */

/** Browser noise that is never actionable — dropped before it leaves the page. */
const IGNORED_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection captured',
];

const dropIgnoredExceptions = (event: CaptureResult | null): CaptureResult | null => {
  if (event?.event !== '$exception') return event;

  const exceptions = (event.properties?.$exception_list ?? []) as Array<{
    type?: string;
    value?: string;
  }>;
  const message = exceptions.map((entry) => `${entry.type ?? ''} ${entry.value ?? ''}`).join(' ');

  return IGNORED_ERRORS.some((ignored) => message.includes(ignored)) ? null : event;
};

posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2025-05-24',
  capture_exceptions: true,
  person_profiles: 'identified_only',
  before_send: dropIgnoredExceptions,
});

export default posthog;

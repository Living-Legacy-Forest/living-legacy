import posthog from 'posthog-js';
import type { CaptureResult } from 'posthog-js';
import { posthogKey } from '@/lib/tracking-client';

/**
 * Browser-side PostHog: product analytics + error tracking.
 *
 * Imported dynamically by `src/components/analytics/PostHog.astro` so the
 * bundle is only fetched when a PostHog key is configured (Settings, or PUBLIC_POSTHOG_KEY).
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

posthog.init(posthogKey()!, {
  api_host: import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2025-05-24',
  capture_exceptions: true,
  person_profiles: 'identified_only',
  before_send: dropIgnoredExceptions,
});

export default posthog;

import { defineMiddleware } from 'astro:middleware';
import { captureServerException } from '@/lib/analytics/posthog-server';
import { isIndexableHost } from '@/lib/seo';

/**
 * Two jobs on every on-demand response:
 *
 * 1. Block indexing on any host that is not the production domain. The header
 *    covers responses a meta tag cannot reach, such as the sitemap, and applies
 *    even if a page forgets to use BaseLayout.
 * 2. Report rendering failures to PostHog error tracking, the server-side
 *    equivalent of the browser's `capture_exceptions`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const response = await next();

    if (!isIndexableHost(context.url.host)) {
      // Response headers are occasionally immutable (redirects, cached asset
      // responses). Blocking indexing must never turn into a 500.
      try {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      } catch {
        /* header not settable on this response; the meta tag still applies */
      }
    }

    return response;
  } catch (error) {
    await captureServerException(error, { route: context.url.pathname });
    throw error;
  }
});

import { defineMiddleware } from 'astro:middleware';
import { captureServerException } from '@/lib/analytics/posthog-server';
import { isIndexableHost } from '@/lib/seo';
import { resolveRedirect } from '@/lib/redirects';

/**
 * Three jobs on every on-demand response:
 *
 * 1. Send legacy URLs (see `src/lib/redirects.ts`) to their new home with a
 *    301, ahead of routing. `public/_redirects` cannot do this on Workers,
 *    since every request — not just static-asset misses — hits the Worker.
 * 2. Block indexing on any host that is not the production domain. The header
 *    covers responses a meta tag cannot reach, such as the sitemap, and applies
 *    even if a page forgets to use BaseLayout.
 * 3. Report rendering failures to PostHog error tracking, the server-side
 *    equivalent of the browser's `capture_exceptions`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const redirectLocation = resolveRedirect(context.url.pathname, context.url.search);
    const response = redirectLocation ? context.redirect(redirectLocation, 301) : await next();

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

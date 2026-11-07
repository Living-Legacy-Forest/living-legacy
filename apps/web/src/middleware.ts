import { defineMiddleware } from 'astro:middleware';
import { captureServerException } from '@/lib/analytics/posthog-server';
import { isIndexableHost } from '@/lib/seo';
import { findRedirect, recordHit, recordNotFound } from '@/lib/redirects';
import { getSiteSettings } from '@/lib/settings';

/**
 * Three jobs on every on-demand response:
 *
 * 1. Apply the redirects managed in the CMS (see `src/lib/redirects.ts`),
 *    ahead of routing. `public/_redirects` cannot do this on Workers, since
 *    every request (not just static-asset misses) hits the Worker.
 * 2. Block indexing on any host that is not the production domain, and
 *    everywhere while Settings hides the site from search engines. The header
 *    covers responses a meta tag cannot reach, such as the sitemap, and applies
 *    even if a page forgets to use BaseLayout.
 * 3. Report rendering failures to PostHog error tracking, the server-side
 *    equivalent of the browser's `capture_exceptions`.
 * 4. Count paths that were not found and no redirect caught, for the CMS's
 *    Missing pages (after the response, so visitors do not wait for it).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const redirect = await findRedirect(context.url);
    if (redirect) context.locals.cfContext?.waitUntil(recordHit(redirect.rule.id));
    const response = !redirect
      ? await next()
      : redirect.location === null
        ? await gone(context.rewrite('/404'))
        : context.redirect(redirect.location, redirect.rule.statusCode === 302 ? 302 : 301);

    if (!redirect && response.status === 404) {
      context.locals.cfContext?.waitUntil(recordNotFound(context.url.pathname));
    }

    if (!isIndexableHost(context.url.host) || (await getSiteSettings()).hideFromSearch) {
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

/** The not-found page, served as 410 Gone for paths removed on purpose. */
async function gone(notFound: Promise<Response>): Promise<Response> {
  const page = await notFound;
  return new Response(page.body, { status: 410, headers: page.headers });
}

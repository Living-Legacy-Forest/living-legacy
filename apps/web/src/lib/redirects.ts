/**
 * Legacy URL redirects, carried over from the WordPress site (see
 * `docs/superpowers/specs/2026-09-24-live-site-rebuild.md` §9).
 *
 * Consumed by `src/middleware.ts` rather than `public/_redirects`: on
 * Cloudflare Workers every request — including ones that would otherwise 404
 * — is handled by the Worker, so a static `_redirects` file never gets a
 * chance to run ahead of routing. Keeping the map here means dev, preview and
 * production all resolve redirects identically.
 */

interface ExactRedirect {
  /** Pathname with no trailing slash, e.g. `/about`. Matched with or without one. */
  from: string;
  /** Destination. May be a root-relative path (optionally with a hash) or an absolute URL. */
  to: string;
}

/** Exact-path redirects (trailing slash on the request is ignored). */
const EXACT_REDIRECTS: ExactRedirect[] = [
  { from: '/about', to: '/#about-section' },
  { from: '/how-it-works', to: '/#how-it-works-section' },
  { from: '/locations', to: '/#location-section' },
  { from: '/pricing', to: '/faqs/#pricing' },
  { from: '/welcome', to: '/' },
  { from: '/5-shocking-truths-about-death', to: '/' },
  { from: '/product-customer-list', to: '/' },
  { from: '/wooling-hill-vic', to: '/#location-section' },
  { from: '/schedule-tour', to: '/#location-section' },
  { from: '/schedule-call', to: '/contact/' },
  { from: '/request-a-callback', to: '/contact/' },
  { from: '/cp-mornington-green', to: '/contact/' },
  { from: '/cp-wellington-dam', to: '/contact/' },
  { from: '/cemetery-partners', to: '/our-partners/' },
  { from: '/our-partners/become-a-partner-form', to: '/our-partners/#become-a-partner-form' },
  {
    from: '/locations/upcoming-location',
    to: '/locations/register-your-interest-for-locations-throughout-australia/',
  },
  { from: '/wellington-dam-wa', to: 'https://livinglegacywellingtondam.org.au/' },
  // Older location pages, still linked from inside some blog posts.
  { from: '/locations/wellington-dam-wa', to: 'https://livinglegacywellingtondam.org.au/' },
  { from: '/locations/mornington-green-vic', to: 'https://morningtongreen.com.au/' },
  { from: '/locations/wooling-hill-vic', to: '/#location-section' },
  { from: '/thank-you', to: '/thank-you-contact/' },
  { from: '/feed', to: '/rss.xml' },
  { from: '/blog/feed', to: '/rss.xml' },
];

const EXACT_REDIRECT_MAP = new Map(EXACT_REDIRECTS.map((rule) => [rule.from, rule.to]));

/** Strips a single trailing slash, except on the root path. */
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Inserts the request's query string before any hash fragment on the target. */
function withSearch(to: string, search: string): string {
  if (!search) return to;

  const hashIndex = to.indexOf('#');
  const base = hashIndex === -1 ? to : to.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : to.slice(hashIndex);
  const joined = base.includes('?') ? `${base}&${search.slice(1)}` : `${base}${search}`;

  return `${joined}${hash}`;
}

/**
 * Resolves a legacy request to its redirect target, or `null` if the path
 * isn't a known legacy URL. `pathname` and `search` come straight off the
 * request URL (`search` includes the leading `?`, or is `''`).
 */
export function resolveRedirect(pathname: string, search: string): string | null {
  // Legacy WordPress URLs are all lowercase, so match case-insensitively.
  const normalized = normalize(pathname).toLowerCase();

  const exact = EXACT_REDIRECT_MAP.get(normalized);
  if (exact) return withSearch(exact, search);

  // Every /thank-you-* variant collapses to the one thank-you page, except
  // /thank-you-contact/ itself (that's the real page, not a legacy alias).
  if (normalized !== '/thank-you-contact' && normalized.startsWith('/thank-you-')) {
    return withSearch('/thank-you-contact/', search);
  }

  // Empty cache-N posts: /blog/cache/ and /blog/cache-12/ etc.
  if (normalized === '/blog/cache' || normalized.startsWith('/blog/cache-')) {
    return withSearch('/blog/', search);
  }

  // The blog's old permalink base was /blogs/<slug>/, still linked from some
  // post bodies. One segment only, so /blogs/ itself is left alone.
  const oldPost = /^\/blogs\/([a-z0-9-]+)$/.exec(normalized);
  if (oldPost) return withSearch(`/blog/${oldPost[1]}/`, search);

  return null;
}

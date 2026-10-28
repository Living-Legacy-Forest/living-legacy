import type { APIRoute } from 'astro';
import { isIndexableHost } from '@/lib/seo';

/**
 * Host-aware robots.txt.
 *
 * Note that non-production hosts still allow crawling. Disallowing would stop
 * crawlers fetching the pages, which means they would never read the noindex
 * directive, and a URL can end up indexed anyway on the strength of external
 * links. Letting them read the noindex is the reliable way to stay out.
 */
export const GET: APIRoute = ({ url, site }) => {
  const body = isIndexableHost(url.host)
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site ?? url.origin).toString()}`,
        '',
      ].join('\n')
    : [
        '# Not the production host. Crawling is permitted so the noindex',
        '# directive on each response can be read, but nothing here is indexed.',
        'User-agent: *',
        'Allow: /',
        '',
      ].join('\n');

  // The X-Robots-Tag header is applied by middleware, which knows whether this
  // host is indexable. Setting it here too would block the production host.
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};

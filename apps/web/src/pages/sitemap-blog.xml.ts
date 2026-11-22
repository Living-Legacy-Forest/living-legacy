import type { APIRoute } from 'astro';
import { sitemapXml } from '@ll/content';
import { getBlogSitemapEntries } from '@/lib/blog-posts';

/**
 * Blog sitemap, rendered on request.
 *
 * Posts come from the CMS and the old WordPress site and render on demand, so the build-time sitemap from
 * @astrojs/sitemap never sees them. The sitemap index lists this file through
 * the integration's `customSitemaps` option.
 */
export const GET: APIRoute = async ({ site, url }) =>
  new Response(sitemapXml(await getBlogSitemapEntries(), site ?? url.origin), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });

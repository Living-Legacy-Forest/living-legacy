import type { APIRoute } from 'astro';
import { sitemapXml } from '@ll/content';
import { getPageSitemapEntries } from '@/lib/page-sitemap';

/**
 * Sitemap for pages outside the blog that render on request (FAQs, In the media, each live
 * location, and the privacy and terms pages), so the build-time sitemap from @astrojs/sitemap
 * never sees them. Listed in the sitemap index through the integration's `customSitemaps`
 * option. What appears is decided from the content (see src/lib/page-sitemap.ts).
 */
export const GET: APIRoute = async ({ site, url }) =>
  new Response(sitemapXml(await getPageSitemapEntries(), site ?? url.origin), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });

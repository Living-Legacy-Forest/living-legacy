import type { APIRoute } from 'astro';
import { getBlogSitemapEntries } from '@/lib/blog-posts';

/**
 * Blog sitemap, rendered on request.
 *
 * Posts come from the CMS and the old WordPress site and render on demand, so the build-time sitemap from
 * @astrojs/sitemap never sees them. The sitemap index lists this file through
 * the integration's `customSitemaps` option.
 */
const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site, url }) => {
  const base = site ?? url.origin;
  const entries = await getBlogSitemapEntries();

  const urls = entries
    .map((entry) => {
      const loc = escapeXml(new URL(entry.path, base).toString());
      const lastmod = entry.lastmod
        ? `<lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`
        : '';
      return `<url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    }
  );
};

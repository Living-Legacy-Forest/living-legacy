import type { APIRoute } from 'astro';
import { getLegalSitemapEntries } from '@/lib/legal-pages';

/**
 * Sitemap for pages outside the blog that render on request (FAQs, In the
 * media, and the privacy and terms pages from the CMS), so the build-time
 * sitemap from @astrojs/sitemap never sees them. Listed in the sitemap index
 * through the integration's `customSitemaps` option.
 */
const PATHS = ['/faqs/', '/about/in-the-media/'];

export const GET: APIRoute = async ({ site, url }) => {
  const base = site ?? url.origin;
  const entries = [
    ...PATHS.map((path) => ({ path, lastmod: undefined as string | undefined })),
    ...(await getLegalSitemapEntries()),
  ];
  const urls = entries
    .map(
      ({ path, lastmod }) =>
        `<url><loc>${new URL(path, base).toString()}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
    )
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

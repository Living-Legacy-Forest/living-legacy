import type { APIRoute } from 'astro';

/**
 * Sitemap for pages outside the blog that render on request, so the build-time
 * sitemap from @astrojs/sitemap never sees them. Listed in the sitemap index
 * through the integration's `customSitemaps` option.
 */
const PATHS = ['/faqs/', '/about/in-the-media/'];

export const GET: APIRoute = ({ site, url }) => {
  const base = site ?? url.origin;
  const urls = PATHS.map((path) => `<url><loc>${new URL(path, base).toString()}</loc></url>`).join(
    ''
  );

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

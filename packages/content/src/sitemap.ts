import { type LocationStage, isSitemapLocation, locationPath } from './locations';

// The XML behind the website's runtime sitemaps (blog and pages), written once so both escape,
// date and de-duplicate the same way. Pure, so it is tested without a database.
export interface SitemapEntry {
  /** A path on the site, e.g. /faqs/. Resolved against the site's origin. */
  path: string;
  /** Anything `Date` can read; an unreadable value is left out rather than breaking the file. */
  lastmod?: string | number | Date | null;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function isoDate(value: SitemapEntry['lastmod']): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * A sitemap urlset. A path listed twice keeps its first entry, so a page that two sources both
 * report appears once.
 */
export function sitemapXml(entries: SitemapEntry[], base: string | URL): string {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const { path, lastmod } of entries) {
    const loc = new URL(path, base).toString();
    if (seen.has(loc)) continue;
    seen.add(loc);
    const modified = isoDate(lastmod);
    urls.push(
      `<url><loc>${escapeXml(loc)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ''}</url>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
}

/** How many published items a page shows, and when the newest changed. */
export interface PageContent {
  count: number;
  /** Epoch milliseconds, or null when there is nothing. */
  lastmod: number | null;
}

/**
 * The pages that render on request, other than the blog: each is listed only when it has
 * something to show, so a search engine is never pointed at an empty page. Pages built ahead of
 * time reach the sitemap from the build instead.
 */
export function pageSitemapEntries(input: {
  /** Published FAQs that sit in a group, which is all the FAQs page shows. */
  faqs: PageContent;
  /** Published press and broadcast coverage. */
  coverage: PageContent;
  locations: {
    slug: string;
    stage: LocationStage;
    status: 'draft' | 'published';
    noindex: boolean;
    deletedAt?: Date | null;
    updatedAt: number;
  }[];
  /** The privacy and terms pages that are published. */
  legal: SitemapEntry[];
}): SitemapEntry[] {
  return [
    ...(input.faqs.count > 0 ? [{ path: '/faqs/', lastmod: input.faqs.lastmod }] : []),
    ...(input.coverage.count > 0
      ? [{ path: '/about/in-the-media/', lastmod: input.coverage.lastmod }]
      : []),
    ...input.locations
      .filter(isSitemapLocation)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((l) => ({ path: locationPath(l.slug), lastmod: l.updatedAt })),
    ...input.legal,
  ];
}

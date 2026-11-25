/**
 * The runtime sitemap for pages outside the blog (/sitemap-pages.xml). What is listed comes from
 * the same database the pages read, so a new location or an emptied FAQ list is reflected without
 * touching a list in code. The rules for what to include live in @ll/content (pageSitemapEntries).
 */
import {
  type LocationStage,
  type PageContent,
  type SitemapEntry,
  pageSitemapEntries,
} from '@ll/content';
import { env } from 'cloudflare:workers';
import { getLegalSitemapEntries } from '@/lib/legal-pages';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): { all<T>(): Promise<{ results: T[] }> };
}

const db = (env as { DB?: D1 }).DB;

/**
 * Locations stay out of the sitemap until /locations/<slug>/ exists: an editor can mark one live
 * today, and the sitemap would then list a URL that returns 404. Set this to true in the change
 * that adds the page.
 */
const LOCATION_PAGES_EXIST = false;

type EventRow = { slug: string; lastmod: number };
type ContentRow = { n: number; lastmod: number | null };
type LocationRow = {
  slug: string;
  stage: LocationStage;
  status: 'draft' | 'published';
  noindex: number;
  updated_at: number;
};

/** A failed read leaves the page out for now rather than failing the whole sitemap. */
async function rows<T>(query: string, what: string): Promise<T[]> {
  if (!db) return [];
  try {
    return (await db.prepare(query).all<T>()).results;
  } catch (error) {
    console.error(`[sitemap] could not read ${what}`, error);
    return [];
  }
}

async function pageContent(query: string, what: string): Promise<PageContent> {
  const [row] = await rows<ContentRow>(query, what);
  return { count: row?.n ?? 0, lastmod: row?.lastmod ?? null };
}

export async function getPageSitemapEntries(): Promise<SitemapEntry[]> {
  const [faqs, coverage, locations, legal, events] = await Promise.all([
    // The FAQs page shows only FAQs that sit in a group.
    pageContent(
      `SELECT COUNT(*) AS n, MAX(f.updated_at) AS lastmod
         FROM faqs f JOIN faq_groups g ON g.id = f.group_id
        WHERE f.status = 'published' AND f.deleted_at IS NULL`,
      'FAQs'
    ),
    pageContent(
      `SELECT COUNT(*) AS n, MAX(updated_at) AS lastmod
         FROM media_coverage WHERE status = 'published' AND deleted_at IS NULL`,
      'media coverage'
    ),
    LOCATION_PAGES_EXIST
      ? rows<LocationRow>(
          `SELECT slug, stage, status, noindex, updated_at FROM locations WHERE deleted_at IS NULL`,
          'locations'
        )
      : [],
    getLegalSitemapEntries(),
    // A repeating event's dates share one page, so each address is listed once (sitemapXml
    // drops the repeats). Cancelled and finished events are not worth a visit from search.
    rows<EventRow>(
      `SELECT slug, MAX(updated_at) AS lastmod FROM events
        WHERE status = 'published' AND ends_at > ${Date.now()} GROUP BY slug ORDER BY slug`,
      'events'
    ),
  ]);

  const eventPages: SitemapEntry[] =
    events.length > 0
      ? [
          { path: '/events/', lastmod: Math.max(...events.map((e) => e.lastmod)) },
          ...events.map((e) => ({ path: `/events/${e.slug}/`, lastmod: e.lastmod })),
        ]
      : [];

  return [
    ...pageSitemapEntries({
      faqs,
      coverage,
      locations: locations.map((l) => ({
        slug: l.slug,
        stage: l.stage,
        status: l.status,
        noindex: l.noindex === 1,
        updatedAt: l.updated_at,
      })),
      legal,
    }),
    ...eventPages,
  ];
}

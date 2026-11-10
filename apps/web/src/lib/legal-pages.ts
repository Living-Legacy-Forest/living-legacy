// The privacy policy and terms, read from the CMS's database on each request.
// Only the live columns: a draft waiting for an admin never reaches the site.
import { type LegalSlug, legalPath, legalSlugs, renderRichText } from '@ll/content';
import { CMS_URL } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import type { BlogHeading } from '@/lib/blog';

interface D1 {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;
const MEDIA_ORIGIN = CMS_URL.replace(/\/+$/, '');

type Row = {
  slug: LegalSlug;
  title: string;
  body: string | null;
  seo_description: string | null;
  last_published_at: number | null;
};

export type LegalPage = {
  title: string;
  html: string;
  headings: BlogHeading[];
  description?: string;
  lastPublishedAt: number | null;
};

/** The published page, or null when it is missing or the database cannot be read. */
export async function getLegalPage(slug: LegalSlug): Promise<LegalPage | null> {
  if (!db) return null;
  try {
    const { results } = await db
      .prepare(
        `select slug, title, body, seo_description, last_published_at
           from legal_pages where slug = ? and status = 'published'`
      )
      .bind(slug)
      .all<Row>();
    const row = results[0];
    if (!row) return null;
    const { html, headings } = renderRichText(row.body ? JSON.parse(row.body) : null, {
      mediaOrigin: MEDIA_ORIGIN,
    });
    return {
      title: row.title,
      html,
      headings,
      description: row.seo_description ?? undefined,
      lastPublishedAt: row.last_published_at,
    };
  } catch (error) {
    console.error('[legal] could not read', slug, error);
    return null;
  }
}

/** "5 August 2026", on the Sydney calendar, so a late-evening publish keeps its date. */
export function formatLegalDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  });
}

export async function getLegalSitemapEntries() {
  const pages = await Promise.all(
    legalSlugs.map(async (slug) => ({ slug, page: await getLegalPage(slug) }))
  );
  return pages
    .filter((p) => p.page)
    .map(({ slug, page }) => ({
      path: legalPath(slug),
      lastmod: page!.lastPublishedAt ? new Date(page!.lastPublishedAt).toISOString() : undefined,
    }));
}

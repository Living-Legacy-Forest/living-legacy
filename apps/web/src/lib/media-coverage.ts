/**
 * Press and broadcast coverage for /about/in-the-media/, managed in the CMS
 * (Media coverage page) and read from the shared D1 database. Uploaded
 * images are served by the CMS, so their paths are pointed at it.
 */
import { type MediaCoverageKind, focalPosition, youtubeId } from '@ll/content';
import { CMS_URL } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import { mediaSources } from '@/lib/media-srcset';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;
const MEDIA_ORIGIN = CMS_URL.replace(/\/+$/, '');

export interface CoverageItem {
  id: string;
  slug: string;
  kind: MediaCoverageKind;
  title: string;
  source: string;
  category: string | null;
  /** ISO date the outlet ran it, if known. */
  date: string | null;
  excerpt: string | null;
  readingMinutes: number | null;
  href: string;
  /** Set for YouTube videos, which play in place. */
  youtubeId: string | null;
  image: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    srcset?: string;
    /** CSS `object-position` keeping the chosen focal point in view when cropped. */
    position?: string;
  } | null;
  featured: boolean;
}

type Row = {
  id: string;
  slug: string;
  kind: MediaCoverageKind;
  title: string;
  source: string;
  category: string | null;
  coverage_date: number | null;
  excerpt: string | null;
  reading_minutes: number | null;
  external_url: string;
  featured: number;
  image_id: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  image_variants: string | null;
  image_focal_x: number | null;
  image_focal_y: number | null;
};

function coverageImage(r: Row, src: string): NonNullable<CoverageItem['image']> {
  return {
    src,
    alt: r.image_alt ?? '',
    width: r.image_width ?? undefined,
    height: r.image_height ?? undefined,
    srcset: mediaSources(src, r.image_width, r.image_variants).srcset,
    position: focalPosition(r.image_focal_x, r.image_focal_y),
  };
}

// Read fresh on every request, so publishing in the CMS shows at once; it is one
// small query. The last good list is kept only to ride out a database error.
let lastGood: CoverageItem[] = [];

/** Published coverage in page order: featured first, then by Order, newest first. */
export async function getMediaCoverage(): Promise<CoverageItem[]> {
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT c.id, c.slug, c.kind, c.title, c.source, c.category, c.coverage_date,
                c.excerpt, c.reading_minutes, c.external_url, c.featured,
                m.id AS image_id, m.alt AS image_alt, m.width AS image_width, m.height AS image_height,
                m.variants AS image_variants, m.focal_x AS image_focal_x, m.focal_y AS image_focal_y
         FROM media_coverage c
         LEFT JOIN media m ON m.id = c.image_media_id
         WHERE c.status = 'published' AND c.deleted_at IS NULL
         ORDER BY c.featured DESC, c.sort_order ASC, c.coverage_date DESC`
      )
      .all<Row>();
    const items = results.map((r): CoverageItem => ({
      id: r.id,
      slug: r.slug,
      kind: r.kind,
      title: r.title,
      source: r.source,
      category: r.category,
      date: r.coverage_date === null ? null : new Date(r.coverage_date).toISOString(),
      excerpt: r.excerpt,
      readingMinutes: r.reading_minutes,
      href: r.external_url,
      youtubeId: r.kind === 'video' ? youtubeId(r.external_url) : null,
      image: r.image_id ? coverageImage(r, `${MEDIA_ORIGIN}/api/media/${r.image_id}`) : null,
      featured: r.featured === 1,
    }));
    lastGood = items;
    return items;
  } catch (error) {
    // A database hiccup must not take the site down; serve the last known
    // list, or none, and try again on the next request.
    console.error('[media-coverage] could not load list', error);
    return lastGood;
  }
}

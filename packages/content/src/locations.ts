// Living Legacy locations, for the national location directory and each
// location's page. Shared by the CMS (to validate and edit) and the site (to
// render). The state is a filter in the directory, never a page of its own.
import { markdownToRichText } from './markdown';
import { type RichTextDoc, isAllowedRichText } from './posts';

export const australianStates = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type AustralianState = (typeof australianStates)[number];

export const australianStateLabels: Record<AustralianState, string> = {
  QLD: 'Queensland',
  NSW: 'New South Wales',
  VIC: 'Victoria',
  WA: 'Western Australia',
  SA: 'South Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
};

/**
 * Where a location stands. `live` has its page on this site; `external` is
 * an existing location whose website has not moved here yet, so the directory
 * links to it; `coming_soon` is listed but has no page to visit.
 */
export const locationStages = ['live', 'external', 'coming_soon'] as const;
export type LocationStage = (typeof locationStages)[number];

export const locationStageLabels: Record<LocationStage, string> = {
  live: 'Live on this site',
  external: 'On its own website',
  coming_soon: 'Coming soon',
};

/** What a location's about is saved as: its column is plain text, holding the document's JSON. */
export function richTextToStored(doc: RichTextDoc | null): string | null {
  return doc ? JSON.stringify(doc) : null;
}

/**
 * A location's about, as the editor and the website use it. It was once written
 * as Markdown, so anything that is not a stored document is read as that, and
 * becomes a document the next time the location is saved.
 */
export function storedToRichText(stored: string | null): RichTextDoc | null {
  const text = stored?.trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (isAllowedRichText(parsed)) return parsed;
    } catch {
      // Text that happens to start with a brace.
    }
  }
  return markdownToRichText(text);
}

/** A location's page path. Only `live` locations have one on this site. */
export const locationPath = (slug: string) => `/locations/${slug}/`;

/**
 * Whether a location's page belongs in the sitemap: published, live on this site (not on its
 * own website, not coming soon), and not hidden from search engines.
 */
export function isSitemapLocation(l: {
  stage: LocationStage;
  status: 'draft' | 'published';
  noindex: boolean;
  deletedAt?: Date | null;
}): boolean {
  return l.stage === 'live' && l.status === 'published' && !l.noindex && !l.deletedAt;
}

// Redirect coverage for the move to the national site: given the old site's addresses, which
// already have a redirect, which are still a page on the new site, and which have neither.
// Pure, so the CMS page and the tests share it. Matching is the website's own (`matchRedirect`).
import { legalPath, legalSlugs } from './legal-pages';
import { blogPath } from './posts';
import { type RedirectRule, matchRedirect, normalizePath } from './redirects';

/** Pages the website has whatever the CMS holds. A test keeps this in step with its pages folder. */
export const STATIC_SITE_PATHS: readonly string[] = [
  '/',
  '/about/in-the-media',
  '/blog',
  '/contact',
  '/faqs',
  '/intellectual-property',
  '/locations',
  '/locations/upcoming',
  '/our-partners',
  '/register-interest',
  '/thank-you-contact',
  ...legalSlugs.map((slug) => normalizePath(legalPath(slug))),
];

/** A forest's page on the national site. */
export const locationPagePath = (slug: string) => `/locations/${slug}`;

/** Every path the new site serves: the fixed pages, plus a page for each of these CMS items. */
export function liveSitePaths(items: {
  postSlugs: string[];
  locationSlugs: string[];
}): Set<string> {
  return new Set([
    ...STATIC_SITE_PATHS.map(normalizePath),
    ...items.postSlugs.map((slug) => normalizePath(blogPath(slug))),
    ...items.locationSlugs.map((slug) => normalizePath(locationPagePath(slug))),
  ]);
}

/** More than this many addresses in one go is a job for a spreadsheet. */
export const MAX_OLD_URLS = 5000;

export interface ParsedOldUrls {
  /** Each address once, as a path: lowercase, no trailing slash. */
  paths: string[];
  /** Lines that were not an address a path rule can match (a query string, another kind of text). */
  ignored: string[];
  /** There were more than `MAX_OLD_URLS`. */
  truncated: boolean;
}

const LOC = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

/** The first part of a line that can be an address: a URL, or a path, in a spreadsheet cell or alone. */
function candidate(line: string): string {
  const cell = line.split(/[,\t;]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
  return cell.find((c) => /^https?:\/\//i.test(c) || c.startsWith('/')) ?? '';
}

/**
 * Reads old addresses from whatever was pasted: one a line, full URLs or paths, a column copied
 * from a spreadsheet, or a whole sitemap. An address with a query string (`/?p=12`) cannot be
 * redirected by its path, so it is set aside rather than counted as the page it falls under.
 */
export function parseOldUrls(text: string): ParsedOldUrls {
  const sitemap = [...text.matchAll(LOC)].map((m) => m[1]!);
  const lines = sitemap.length > 0 ? sitemap : text.split(/\r?\n/);
  const seen = new Set<string>();
  const paths: string[] = [];
  const ignored: string[] = [];
  let truncated = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const found = sitemap.length > 0 ? line : candidate(line);
    let pathname: string;
    let search = '';
    try {
      const url = new URL(found, 'https://old.invalid');
      if (!found) throw new Error('not an address');
      pathname = decodeURI(url.pathname);
      search = url.search;
    } catch {
      ignored.push(line);
      continue;
    }
    if (search) {
      ignored.push(line);
      continue;
    }
    const path = normalizePath(pathname);
    if (seen.has(path)) continue;
    if (paths.length >= MAX_OLD_URLS) {
      truncated = true;
      break;
    }
    seen.add(path);
    paths.push(path);
  }
  return { paths, ignored, truncated };
}

export type CoverageStatus = 'redirected' | 'live' | 'missing';

export interface CoverageRow {
  path: string;
  status: CoverageStatus;
  /** For `redirected`: the rule's destination, or null when the rule says the page is gone (410). */
  to?: string | null;
  statusCode?: number;
  /** A rule ending in * catches it, rather than a rule for this exact address. */
  viaWildcard?: boolean;
}

/**
 * Sorts each old address: redirected (a rule catches it, and rules run before pages, as on the
 * website), still a page on the new site, or missing, which needs a redirect.
 */
export function classifyCoverage(
  paths: readonly string[],
  rules: RedirectRule[],
  live: ReadonlySet<string>
): CoverageRow[] {
  return paths.map((path) => {
    const match = matchRedirect(rules, path);
    if (match) {
      return {
        path,
        status: 'redirected',
        to: match.location,
        statusCode: match.rule.statusCode,
        viaWildcard: match.rule.fromPath.endsWith('*'),
      };
    }
    return { path, status: live.has(path) ? 'live' : 'missing' };
  });
}

export function coverageCounts(rows: readonly CoverageRow[]) {
  const counts = { redirected: 0, live: 0, missing: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

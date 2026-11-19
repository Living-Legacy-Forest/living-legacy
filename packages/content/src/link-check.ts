// Broken links inside the site's own content: a link to a page that is not there and has no
// redirect. Pure, so it is tested without a database; the CMS feeds it each item's links.
// Only links to this site are judged. Another site's pages cannot be checked without asking it.
import { type RedirectRule, matchRedirect, normalizePath } from './redirects';
import { type OutlineLink, linkKind } from './rich-text-outline';

/**
 * Parts of the site whose pages cannot be told from the content alone: files, the CMS's own
 * endpoints, and blog listings and event pages. They are left alone rather than called broken.
 */
const UNCHECKED = [
  '/media/',
  '/documents/',
  '/api/',
  '/_astro/',
  '/assets/',
  '/events/',
  '/blog/category/',
  '/blog/tag/',
  '/blog/author/',
  '/blog/page/',
];

/** The path a link to this site goes to (no query, no hash), or null if it cannot be judged. */
export function linkPath(href: string): string | null {
  if (linkKind(href) !== 'internal') return null;
  let pathname: string;
  try {
    pathname = decodeURI(new URL(href.trim(), 'https://site.invalid').pathname);
  } catch {
    return null;
  }
  const path = normalizePath(pathname);
  if (UNCHECKED.some((prefix) => `${path}/`.startsWith(prefix))) return null;
  // A file (a PDF, an image) is not a page.
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return null;
  return path;
}

export interface BrokenLink {
  /** As it was written in the content. */
  href: string;
  text: string;
  /** `missing`: no page and no redirect. `gone`: a redirect says the page has been removed. */
  reason: 'missing' | 'gone';
}

/**
 * The links among these that lead nowhere. A redirect makes a link work (it is not broken), and
 * so does a page the site serves; a redirect that marks the page gone (410) does not.
 */
export function brokenLinks(
  links: readonly Pick<OutlineLink, 'href' | 'text'>[],
  rules: RedirectRule[],
  live: ReadonlySet<string>
): BrokenLink[] {
  const found: BrokenLink[] = [];
  const seen = new Set<string>();
  for (const { href, text } of links) {
    const path = linkPath(href);
    if (path === null || seen.has(path)) continue;
    seen.add(path);
    const match = matchRedirect(rules, path);
    if (match) {
      if (match.location === null) found.push({ href, text, reason: 'gone' });
    } else if (!live.has(path)) {
      found.push({ href, text, reason: 'missing' });
    }
  }
  return found;
}

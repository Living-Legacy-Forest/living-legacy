// Search problems that show only across several pages, found from the CMS's own data: two posts
// asking to be shown the same way, and a published page that a redirect sends visitors away from.
// Pure, so it is tested without a database. A live fetch of every sitemap URL is not done here.
import { type RedirectRule, matchRedirect } from './redirects';

/** Lowercase, one space between words, so "Coping  with Loss " and "coping with loss" match. */
const normalise = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

export interface SearchTextPost {
  id: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
}

export interface DuplicateSearchText {
  kind: 'title' | 'description';
  /** The text as the first post wrote it. */
  text: string;
  posts: { id: string; title: string }[];
}

/**
 * Search results for posts that read the same are hard to tell apart, so each shared title and
 * description is listed with the posts that use it. The text compared is what the website shows:
 * the search title or else the post title, the search description or else the excerpt. The most
 * shared come first.
 */
export function duplicateSearchText(posts: SearchTextPost[]): DuplicateSearchText[] {
  const found: DuplicateSearchText[] = [];
  const kinds = [
    ['title', (p: SearchTextPost) => p.seoTitle || p.title],
    ['description', (p: SearchTextPost) => p.seoDescription || p.excerpt],
  ] as const;

  for (const [kind, textOf] of kinds) {
    const groups = new Map<string, DuplicateSearchText>();
    for (const post of posts) {
      const text = textOf(post);
      const key = normalise(text);
      if (!key) continue;
      const group = groups.get(key) ?? { kind, text: text.trim(), posts: [] };
      group.posts.push({ id: post.id, title: post.title });
      groups.set(key, group);
    }
    found.push(...[...groups.values()].filter((g) => g.posts.length > 1));
  }

  return found.sort((a, b) => b.posts.length - a.posts.length);
}

export interface RedirectedPage {
  id: string;
  title: string;
  path: string;
  /** Where visitors are sent, or null when the redirect says the page is gone (410). */
  to: string | null;
  gone: boolean;
}

/**
 * Published pages that an enabled redirect answers instead, so visitors and search engines never
 * reach them. The same matching the website applies to a request decides what counts.
 */
export function redirectedPages(
  pages: { id: string; title: string; path: string }[],
  rules: RedirectRule[]
): RedirectedPage[] {
  return pages.flatMap((page) => {
    const match = matchRedirect(rules, page.path);
    return match ? [{ ...page, to: match.location, gone: match.location === null }] : [];
  });
}

/**
 * The blog, from two sources: posts written in the CMS, and posts still on
 * the old WordPress site. A CMS post with the same slug as a WordPress one
 * replaces it, so moving a post across is just a matter of publishing it in
 * the CMS under the same slug; the WordPress copy drops out by itself.
 *
 * With well under a few hundred posts, everything (paging, archives, search)
 * works on the merged list in memory. Each source caches and soft-fails on
 * its own (src/lib/blog-cms.ts, src/lib/blog-wordpress.ts).
 */
import { type BlogAuthor, type BlogPage, type BlogPost, type BlogTerm } from '@/lib/blog';
import { getCmsPosts } from '@/lib/blog-cms';
import { getWordPressPosts } from '@/lib/blog-wordpress';

/** How many posts an index or archive page shows at once. */
export const BLOG_PAGE_SIZE = 12;

/** Every published post, newest first. */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const [cms, wordpress] = await Promise.all([getCmsPosts(), getWordPressPosts()]);
  const moved = new Set(cms.map((post) => post.slug));
  return [...cms, ...wordpress.filter((post) => !moved.has(post.slug))].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}

function paginate(posts: BlogPost[], page: number): BlogPage {
  const current = Math.max(1, Math.floor(page) || 1);
  const from = (current - 1) * BLOG_PAGE_SIZE;
  return {
    posts: posts.slice(from, from + BLOG_PAGE_SIZE),
    total: posts.length,
    page: current,
    pageCount: Math.ceil(posts.length / BLOG_PAGE_SIZE),
  };
}

/** One page of the blog index, newest first. */
export async function getBlogPage(page = 1): Promise<BlogPage> {
  return paginate(await getAllBlogPosts(), page);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  return (await getAllBlogPosts()).find((post) => post.slug === slug) ?? null;
}

/**
 * Same category first, then anything else to fill the row. Without the
 * filler the strip renders one card next to two gaps whenever a category is
 * thin, which looks broken rather than sparse.
 */
export async function getRelatedBlogPosts(post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = (await getAllBlogPosts()).filter((p) => p.id !== post.id);
  const category = post.category?.slug;
  const related = category ? others.filter((p) => p.category?.slug === category) : [];
  const fillers = others.filter((p) => !related.includes(p));
  return [...related, ...fillers].slice(0, limit);
}

// --- Taxonomy archives -------------------------------------------------

/** A term (category or tag) by slug, from whichever posts carry it. */
function findTerm(posts: BlogPost[], pick: (p: BlogPost) => BlogTerm[], slug: string) {
  for (const post of posts) {
    const term = pick(post).find((t) => t.slug === slug);
    if (term) return term;
  }
  return null;
}

export async function getCategoryBySlug(slug: string): Promise<BlogTerm | null> {
  return findTerm(await getAllBlogPosts(), (p) => p.categories, slug);
}

export async function getPostsByCategory(categorySlug: string, page = 1): Promise<BlogPage> {
  const posts = await getAllBlogPosts();
  return paginate(
    posts.filter((p) => p.categories.some((c) => c.slug === categorySlug)),
    page
  );
}

export async function getTagBySlug(slug: string): Promise<BlogTerm | null> {
  return findTerm(await getAllBlogPosts(), (p) => p.tags, slug);
}

export async function getPostsByTag(tagSlug: string, page = 1): Promise<BlogPage> {
  const posts = await getAllBlogPosts();
  return paginate(
    posts.filter((p) => p.tags.some((t) => t.slug === tagSlug)),
    page
  );
}

export async function getAuthorBySlug(slug: string): Promise<BlogAuthor | null> {
  return (await getAllBlogPosts()).find((p) => p.author?.slug === slug)?.author ?? null;
}

export async function getPostsByAuthor(authorSlug: string, page = 1): Promise<BlogPage> {
  const posts = await getAllBlogPosts();
  return paginate(
    posts.filter((p) => p.author?.slug === authorSlug),
    page
  );
}

// --- Search and filter -------------------------------------------------

export interface BlogTagCount extends BlogTerm {
  count: number;
}

/** Tags with at least one published post, busiest first, for the filter chips. */
export async function getBlogTags(): Promise<BlogTagCount[]> {
  const counts = new Map<string, BlogTagCount>();
  for (const post of await getAllBlogPosts()) {
    for (const tag of post.tags) {
      const entry = counts.get(tag.slug) ?? { ...tag, count: 0 };
      entry.count += 1;
      counts.set(tag.slug, entry);
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.title.toLowerCase().localeCompare(b.title.toLowerCase())
  );
}

/**
 * The words of a search, lower-cased. Every word must match (each as the start
 * of a word), so more words narrow the results rather than widen them.
 * Punctuation is dropped and the query capped, so a pasted essay stays cheap.
 */
export function searchTerms(q: string): string[] {
  return q
    .slice(0, 100)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.replace(/['-]/g, '').length > 0)
    .slice(0, 8);
}

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}'-]+/u);

/** How many of `terms` start a word in `text`; 0 if any one is missing. */
function matchCount(terms: string[], text: string): number {
  const list = words(text);
  return terms.every((term) => list.some((w) => w.startsWith(term))) ? terms.length : 0;
}

/**
 * The blog index narrowed by a search, a tag, or both. With a search, results
 * rank by relevance (a title match counts three times a match in the excerpt
 * or body), newest first among equals; with only a tag, newest first.
 */
export async function searchBlogPosts({
  q = '',
  tag = '',
  page = 1,
}: {
  q?: string;
  tag?: string;
  page?: number;
}): Promise<BlogPage> {
  const terms = searchTerms(q);
  let posts = await getAllBlogPosts();
  if (tag) posts = posts.filter((p) => p.tags.some((t) => t.slug === tag));
  if (terms.length) {
    const scored = posts
      .map((post) => {
        const all = matchCount(terms, `${post.title} ${post.excerpt ?? ''} ${post.text}`);
        const score = all && 3 * matchCount(terms, post.title) + all;
        return { post, score };
      })
      .filter((s) => s.score > 0);
    // Array sort is stable, so equal scores keep the newest-first order.
    posts = scored.sort((a, b) => b.score - a.score).map((s) => s.post);
  }
  return paginate(posts, page);
}

// --- Feed + sitemap -------------------------------------------------------

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

/**
 * Every blog URL for the on-demand sitemap: posts that may be indexed, plus
 * the category, tag and author archives that have at least one post.
 */
export async function getBlogSitemapEntries(): Promise<SitemapEntry[]> {
  const posts = (await getAllBlogPosts()).filter((p) => !p.noindex);
  const unique = (paths: string[]) => [...new Set(paths)].map((path) => ({ path }));
  return [
    ...posts.map((post) => ({
      path: `/blog/${post.slug}/`,
      lastmod: post.updatedAt ?? post.publishedAt,
    })),
    ...unique(posts.flatMap((p) => p.categories.map((c) => `/blog/category/${c.slug}/`))),
    ...unique(posts.flatMap((p) => p.tags.map((t) => `/blog/tag/${t.slug}/`))),
    ...unique(posts.flatMap((p) => (p.author ? [`/blog/author/${p.author.slug}/`] : []))),
  ];
}

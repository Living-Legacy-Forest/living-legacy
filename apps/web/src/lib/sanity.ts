import { createClient, type SanityClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION } from 'astro:env/server';

import { getReadingTime } from '@/lib/blog';
import type { SanityAuthor, SanityBlogPost, SanityCategory, SanityTag } from '@/types';

/** Public project id, so a missing env var cannot silently empty the blog. */
const PROJECT_ID = SANITY_PROJECT_ID ?? '6nf0cv12';

let client: SanityClient | null = null;

/**
 * Request-time Sanity client.
 *
 * `useCdn: false` so on-demand rendered pages always read the latest published
 * content — that is what removes the need for a rebuild on publish. Env is read
 * through `astro:env/server`, which resolves from the Workers runtime rather
 * than being inlined at build time.
 */
export function getSanityClient(): SanityClient {
  client ??= createClient({
    projectId: PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    useCdn: false,
    perspective: 'published',
  });

  return client;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const imageBuilder = createImageUrlBuilder({
  projectId: PROJECT_ID,
  dataset: SANITY_DATASET,
});

interface ImageUrlOptions {
  width?: number;
  height?: number;
  fit?: 'crop' | 'max' | 'fillmax' | 'min' | 'scale' | 'clip' | 'fill';
}

/**
 * Builds a Sanity CDN URL from an image field's asset reference.
 *
 * Queries below deliberately do not dereference `asset -> { url }`: a plain
 * asset reference is all `@sanity/image-url` needs, and skipping the deref
 * keeps every GROQ projection in this file a fetch of document fields only,
 * no joins.
 */
export function imageUrl(
  image: { asset?: { _ref?: string } } | undefined,
  opts: ImageUrlOptions = {}
): string | undefined {
  const ref = image?.asset?._ref;
  if (!ref) return undefined;
  let b = imageBuilder.image(ref).auto('format');
  if (opts.width) b = b.width(opts.width);
  if (opts.height) b = b.height(opts.height);
  if (opts.fit) b = b.fit(opts.fit);
  return b.url();
}

/**
 * A Sanity image asset id encodes its original pixel dimensions, e.g.
 * `image-abc123-2362x1329-webp`. Reading them here means every `<img>` can
 * carry real `width`/`height` attributes, so the browser reserves the right
 * box before the image arrives, without a second query to fetch asset
 * metadata.
 */
export function imageDimensions(ref: string | undefined): { width: number; height: number } | null {
  const match = ref?.match(/-(\d+)x(\d+)-/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Runs a query and falls back rather than throwing.
 *
 * The blog routes render on demand, so a query runs on every request. A
 * Sanity blip must not take the route down with it: an index that shows no
 * posts for one request and recovers on the next is a far better failure
 * than a 500. The article and archive routes check for an empty result and
 * rewrite to 404 themselves, so a genuine outage reads as "not found" for the
 * moment it lasts rather than throwing.
 */
async function safeSanity<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[sanity] ${label} failed:`, error);
    return fallback;
  }
}

/** How many posts an index or archive page shows at once. */
export const BLOG_PAGE_SIZE = 12;

// What a card needs: enough to render the index, an archive or the related
// strip, and no body, which is the expensive part of the document.
const BLOG_CARD = `
  _id, title, slug, publishedAt, excerpt, isFeatured,
  featuredImage { asset, alt },
  "category": categories[0] -> { _id, title, slug },
  author -> { _id, name, slug, role }
`;

// The article itself.
const BLOG_FULL = `
  _id, _updatedAt, title, slug, publishedAt, updatedAt, excerpt, isFeatured,
  seoTitle, seoDescription,
  body,
  featuredImage { asset, alt },
  "category": categories[0] -> { _id, title, slug },
  "categories": categories[] -> { _id, title, slug },
  "tags": tags[] -> { _id, title, slug },
  author -> { _id, name, slug, role, bio }
`;

// `publishedAt <= now()` is the scheduling gate: setting a future date holds a
// post back without anyone having to remember to publish it on the day.
const PUBLISHED = `_type == "blog" && defined(slug.current) && publishedAt <= now()`;

export interface BlogPage {
  posts: SanityBlogPost[];
  total: number;
  page: number;
  pageCount: number;
}

function withReadingTime(posts: (SanityBlogPost & { body?: unknown[] })[]): SanityBlogPost[] {
  return posts.map(({ body, ...rest }) => ({ ...rest, readingTime: getReadingTime(body) }));
}

/** One page of the blog index, newest first. */
export async function getBlogPage(page = 1): Promise<BlogPage> {
  const current = Math.max(1, Math.floor(page) || 1);
  const empty: BlogPage = { posts: [], total: 0, page: 1, pageCount: 0 };

  return safeSanity('getBlogPage', empty, async () => {
    const from = (current - 1) * BLOG_PAGE_SIZE;
    const result = await getSanityClient().fetch<{
      total: number;
      posts: (SanityBlogPost & { body?: unknown[] })[];
    }>(
      `{
        "total": count(*[${PUBLISHED}]),
        "posts": *[${PUBLISHED}] | order(publishedAt desc) [$from...$to] { ${BLOG_CARD}, body }
      }`,
      { from, to: from + BLOG_PAGE_SIZE }
    );

    return {
      posts: withReadingTime(result.posts),
      total: result.total,
      page: current,
      pageCount: Math.ceil(result.total / BLOG_PAGE_SIZE),
    };
  });
}

export async function getBlogPostBySlug(slug: string): Promise<SanityBlogPost | null> {
  return safeSanity('getBlogPostBySlug', null, async () => {
    const post = await getSanityClient().fetch<(SanityBlogPost & { body?: unknown[] }) | null>(
      `*[${PUBLISHED} && slug.current == $slug][0] { ${BLOG_FULL} }`,
      { slug }
    );
    if (!post) return null;
    const { body, ...rest } = post;
    return { ...rest, body, readingTime: getReadingTime(body) };
  });
}

/**
 * Same category first, then anything else to fill the row. Without the
 * filler the strip renders one card next to two gaps whenever a category is
 * thin, which looks broken rather than sparse.
 */
export async function getRelatedBlogPosts(
  currentId: string,
  categoryId: string | undefined,
  limit = 3
): Promise<SanityBlogPost[]> {
  return safeSanity('getRelatedBlogPosts', [], async () => {
    const client = getSanityClient();

    if (!categoryId) {
      const posts = await client.fetch<SanityBlogPost[]>(
        `*[${PUBLISHED} && _id != $currentId] | order(publishedAt desc)[0...$limit] { ${BLOG_CARD} }`,
        { currentId, limit }
      );
      return posts;
    }

    const related = await client.fetch<SanityBlogPost[]>(
      `*[${PUBLISHED} && _id != $currentId && $categoryId in categories[]._ref]
        | order(publishedAt desc)[0...$limit] { ${BLOG_CARD} }`,
      { currentId, categoryId, limit }
    );
    if (related.length >= limit) return related;

    const fillers = await client.fetch<SanityBlogPost[]>(
      `*[${PUBLISHED} && _id != $currentId && !($categoryId in categories[]._ref)]
        | order(publishedAt desc)[0...$fillCount] { ${BLOG_CARD} }`,
      { currentId, categoryId, fillCount: limit - related.length }
    );
    return [...related, ...fillers];
  });
}

// --- Taxonomy archives -------------------------------------------------

export async function getCategoryBySlug(slug: string): Promise<SanityCategory | null> {
  return safeSanity('getCategoryBySlug', null, () =>
    getSanityClient().fetch<SanityCategory | null>(
      `*[_type == "category" && slug.current == $slug][0] { _id, title, slug, description }`,
      { slug }
    )
  );
}

export async function getPostsByCategory(categorySlug: string, page = 1): Promise<BlogPage> {
  const current = Math.max(1, Math.floor(page) || 1);
  const empty: BlogPage = { posts: [], total: 0, page: 1, pageCount: 0 };

  return safeSanity('getPostsByCategory', empty, async () => {
    const filter = `${PUBLISHED} && $categorySlug in categories[]->slug.current`;
    const from = (current - 1) * BLOG_PAGE_SIZE;
    const result = await getSanityClient().fetch<{
      total: number;
      posts: (SanityBlogPost & { body?: unknown[] })[];
    }>(
      `{
        "total": count(*[${filter}]),
        "posts": *[${filter}] | order(publishedAt desc) [$from...$to] { ${BLOG_CARD}, body }
      }`,
      { categorySlug, from, to: from + BLOG_PAGE_SIZE }
    );

    return {
      posts: withReadingTime(result.posts),
      total: result.total,
      page: current,
      pageCount: Math.ceil(result.total / BLOG_PAGE_SIZE),
    };
  });
}

export async function getTagBySlug(slug: string): Promise<SanityTag | null> {
  return safeSanity('getTagBySlug', null, () =>
    getSanityClient().fetch<SanityTag | null>(
      `*[_type == "tag" && slug.current == $slug][0] { _id, title, slug }`,
      { slug }
    )
  );
}

export async function getPostsByTag(tagSlug: string, page = 1): Promise<BlogPage> {
  const current = Math.max(1, Math.floor(page) || 1);
  const empty: BlogPage = { posts: [], total: 0, page: 1, pageCount: 0 };

  return safeSanity('getPostsByTag', empty, async () => {
    const filter = `${PUBLISHED} && $tagSlug in tags[]->slug.current`;
    const from = (current - 1) * BLOG_PAGE_SIZE;
    const result = await getSanityClient().fetch<{
      total: number;
      posts: (SanityBlogPost & { body?: unknown[] })[];
    }>(
      `{
        "total": count(*[${filter}]),
        "posts": *[${filter}] | order(publishedAt desc) [$from...$to] { ${BLOG_CARD}, body }
      }`,
      { tagSlug, from, to: from + BLOG_PAGE_SIZE }
    );

    return {
      posts: withReadingTime(result.posts),
      total: result.total,
      page: current,
      pageCount: Math.ceil(result.total / BLOG_PAGE_SIZE),
    };
  });
}

// --- Search and filter -------------------------------------------------

export interface BlogTagCount extends SanityTag {
  count: number;
}

/** Tags with at least one published post, busiest first, for the filter chips. */
export async function getBlogTags(): Promise<BlogTagCount[]> {
  return safeSanity('getBlogTags', [], () =>
    getSanityClient().fetch<BlogTagCount[]>(
      `*[_type == "tag" && defined(slug.current)] {
        _id, title, slug,
        "count": count(*[${PUBLISHED} && references(^._id)])
      } [count > 0] | order(count desc, lower(title) asc)`
    )
  );
}

/**
 * The words of a search, each made a prefix ("mush" finds "mushroom").
 * GROQ's `match` with an array requires every term, so more words narrow the
 * results rather than widen them. Punctuation is dropped (it would otherwise
 * reach `match` as wildcards or operators) and the query is capped so a
 * pasted essay cannot become an expensive query.
 */
export function searchTerms(q: string): string[] {
  return q
    .slice(0, 100)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.replace(/['-]/g, '').length > 0)
    .slice(0, 8)
    .map((word) => `${word}*`);
}

/**
 * The blog index narrowed by a search, a tag, or both. With a search,
 * results rank by relevance (a title match counts three times a match in the
 * excerpt or body), newest first among equals; with only a tag, newest first.
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
  const current = Math.max(1, Math.floor(page) || 1);
  const empty: BlogPage = { posts: [], total: 0, page: 1, pageCount: 0 };
  const terms = searchTerms(q);

  return safeSanity('searchBlogPosts', empty, async () => {
    const conditions = [PUBLISHED];
    if (terms.length) conditions.push('[title, excerpt, pt::text(body)] match $terms');
    if (tag) conditions.push('$tag in tags[]->slug.current');
    const filter = conditions.join(' && ');

    const order = terms.length
      ? `| score(boost(title match $terms, 3), excerpt match $terms, pt::text(body) match $terms)
         | order(_score desc, publishedAt desc)`
      : '| order(publishedAt desc)';

    const from = (current - 1) * BLOG_PAGE_SIZE;
    const params: Record<string, string | number | string[]> = { from, to: from + BLOG_PAGE_SIZE };
    if (terms.length) params.terms = terms;
    if (tag) params.tag = tag;
    const result = await getSanityClient().fetch<{
      total: number;
      posts: (SanityBlogPost & { body?: unknown[] })[];
    }>(
      `{
        "total": count(*[${filter}]),
        "posts": *[${filter}] ${order} [$from...$to] { ${BLOG_CARD}, body }
      }`,
      params
    );

    return {
      posts: withReadingTime(result.posts),
      total: result.total,
      page: current,
      pageCount: Math.ceil(result.total / BLOG_PAGE_SIZE),
    };
  });
}

export async function getAuthorBySlug(slug: string): Promise<SanityAuthor | null> {
  return safeSanity('getAuthorBySlug', null, () =>
    getSanityClient().fetch<SanityAuthor | null>(
      `*[_type == "author" && slug.current == $slug][0] { _id, name, slug, role, bio }`,
      { slug }
    )
  );
}

export async function getPostsByAuthor(authorSlug: string, page = 1): Promise<BlogPage> {
  const current = Math.max(1, Math.floor(page) || 1);
  const empty: BlogPage = { posts: [], total: 0, page: 1, pageCount: 0 };

  return safeSanity('getPostsByAuthor', empty, async () => {
    const filter = `${PUBLISHED} && author->slug.current == $authorSlug`;
    const from = (current - 1) * BLOG_PAGE_SIZE;
    const result = await getSanityClient().fetch<{
      total: number;
      posts: (SanityBlogPost & { body?: unknown[] })[];
    }>(
      `{
        "total": count(*[${filter}]),
        "posts": *[${filter}] | order(publishedAt desc) [$from...$to] { ${BLOG_CARD}, body }
      }`,
      { authorSlug, from, to: from + BLOG_PAGE_SIZE }
    );

    return {
      posts: withReadingTime(result.posts),
      total: result.total,
      page: current,
      pageCount: Math.ceil(result.total / BLOG_PAGE_SIZE),
    };
  });
}

// --- Feed + sitemap -------------------------------------------------------

/** Every published post, newest first — backs /rss.xml. */
export async function getAllBlogPosts(): Promise<SanityBlogPost[]> {
  return safeSanity('getAllBlogPosts', [], () =>
    getSanityClient().fetch<SanityBlogPost[]>(
      `*[${PUBLISHED}] | order(publishedAt desc) { ${BLOG_CARD} }`
    )
  );
}

/**
 * Every published post slug. The sitemap integration only discovers
 * prerendered routes, so it cannot see these on-demand ones; whatever wires
 * up the sitemap needs this list to add `/blog/<slug>/` for each one.
 */
export async function getAllPostSlugs(): Promise<string[]> {
  return safeSanity('getAllPostSlugs', [], async () => {
    const slugs = await getSanityClient().fetch<string[]>(`*[${PUBLISHED}].slug.current`);
    return slugs;
  });
}

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

/**
 * Every blog URL for the on-demand sitemap: posts with their last change, plus
 * the category, tag and author archives that have at least one post.
 */
export async function getBlogSitemapEntries(): Promise<SitemapEntry[]> {
  return safeSanity('getBlogSitemapEntries', [], async () => {
    const data = await getSanityClient().fetch<{
      posts: { slug: string; lastmod: string }[];
      categories: string[];
      tags: string[];
      authors: string[];
    }>(`{
      "posts": *[${PUBLISHED}] | order(publishedAt desc) { "slug": slug.current, "lastmod": coalesce(updatedAt, publishedAt) },
      "categories": *[_type == "category" && count(*[${PUBLISHED} && references(^._id)]) > 0].slug.current,
      "tags": *[_type == "tag" && count(*[${PUBLISHED} && references(^._id)]) > 0].slug.current,
      "authors": *[_type == "author" && count(*[${PUBLISHED} && references(^._id)]) > 0].slug.current
    }`);

    return [
      ...data.posts.map((post) => ({ path: `/blog/${post.slug}/`, lastmod: post.lastmod })),
      ...data.categories.map((slug) => ({ path: `/blog/category/${slug}/` })),
      ...data.tags.map((slug) => ({ path: `/blog/tag/${slug}/` })),
      ...data.authors.map((slug) => ({ path: `/blog/author/${slug}/` })),
    ];
  });
}

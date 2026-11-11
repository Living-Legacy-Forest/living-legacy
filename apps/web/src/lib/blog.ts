// The blog's shared shapes and helpers. Posts come from two places (see
// src/lib/blog-posts.ts): the CMS, and the old WordPress site for anything not
// yet moved across. Both are mapped onto these types, so pages and components
// never need to know which one a post came from.

const WORDS_PER_MINUTE = 200;

export interface BlogTerm {
  slug: string;
  title: string;
  description?: string;
}

export interface BlogAuthor {
  slug: string;
  name: string;
  role?: string;
  bio?: string;
}

export interface BlogImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /** A smaller rendition for cards, when the source offers one. */
  cardUrl?: string;
  /** Smaller renditions with their widths, as an `srcset`, when the source has them. */
  srcset?: string;
}

export interface BlogHeading {
  id: string;
  text: string;
}

export interface BlogPost {
  /** Unique across both sources, e.g. "cms:01J…" or "wp:14830". */
  id: string;
  source: 'cms' | 'wordpress';
  slug: string;
  title: string;
  excerpt?: string;
  publishedAt: string;
  updatedAt?: string;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  noindex?: boolean;
  /** Another page search engines should credit instead; such posts leave the sitemap. */
  canonicalUrl?: string;
  /** The share card's wording, when it differs from the search listing. */
  socialTitle?: string;
  socialDescription?: string;
  /** Finer robots directives for an indexed post. */
  nofollow?: boolean;
  nosnippet?: boolean;
  noimageindex?: boolean;
  image?: BlogImage;
  /** The share image, when it differs from the featured image. */
  ogImageUrl?: string;
  /** The first category, shown on cards. */
  category?: BlogTerm;
  categories: BlogTerm[];
  tags: BlogTerm[];
  author?: BlogAuthor;
  readingTime: number;
  /** Plain text of the body, for search. */
  text: string;
  /** The rendered body, with ids on its H2s. */
  html: string;
  headings: BlogHeading[];
}

export interface BlogPage {
  posts: BlogPost[];
  total: number;
  page: number;
  pageCount: number;
}

/** Rounds up, and never returns 0: "0 min read" reads as an error. */
export function getReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/**
 * When a post was last meaningfully updated: its updated date when later than
 * the publish date, otherwise the publish date. The article header and its
 * JSON-LD both read this, so they never disagree.
 */
export function lastUpdatedAt(post: { publishedAt: string; updatedAt?: string }): string {
  const { publishedAt, updatedAt } = post;
  return updatedAt && new Date(updatedAt) > new Date(publishedAt) ? updatedAt : publishedAt;
}

/** en-AU, not "August 5, 2026": "5 August 2026". */
export function formatBlogDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

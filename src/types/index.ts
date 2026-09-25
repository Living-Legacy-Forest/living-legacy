// Shared TypeScript types for livinglegacyforest.com.au

export interface SanitySlug {
  current: string;
}

export interface SanityImageAsset {
  /** The raw asset reference, e.g. "image-abc123-2362x1329-webp". Present
   * whenever `asset` was projected as a reference rather than dereferenced. */
  _ref?: string;
  url?: string;
  metadata?: { dimensions?: { width: number; height: number } };
}

export interface SanityImage {
  asset?: SanityImageAsset;
  alt?: string;
}

export interface SanityCategory {
  _id: string;
  title: string;
  slug: SanitySlug;
  description?: string;
}

export interface SanityTag {
  _id: string;
  title: string;
  slug: SanitySlug;
}

export interface SanityAuthor {
  _id: string;
  name: string;
  slug: SanitySlug;
  role?: string;
  bio?: string;
  avatarUrl?: string;
  avatarAlt?: string;
}

/** What a blog card needs: enough to render the index and related-posts grid. */
export interface SanityBlogPost {
  _id: string;
  _updatedAt?: string;
  title: string;
  slug: SanitySlug;
  publishedAt: string;
  updatedAt?: string;
  excerpt?: string;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: SanityImage;
  category?: SanityCategory;
  categories?: SanityCategory[];
  tags?: SanityTag[];
  author?: SanityAuthor;
  readingTime?: number;
  /** Present only on the full article fetch. */
  body?: unknown[];
}

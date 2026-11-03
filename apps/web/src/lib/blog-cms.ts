/**
 * Posts written in the CMS, read from the shared D1 database. Only the live
 * version counts: published, not in the trash, and due (a scheduled post
 * shows once its time comes). Uploaded images are served by the CMS, so their
 * paths are pointed at it.
 */
import {
  type RichTextDoc,
  isAllowedRichText,
  renderRichText,
  richTextPlainText,
  slugify,
} from '@ll/content';
import { CMS_URL } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import { type BlogPost, type BlogTerm, getReadingTime } from '@/lib/blog';
import { mediaSources } from '@/lib/media-srcset';

/** The slice of the D1 binding used here, so the site needs no Workers type package. */
interface D1 {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;
const MEDIA_ORIGIN = CMS_URL.replace(/\/+$/, '');
const mediaUrl = (id: string) => `${MEDIA_ORIGIN}/api/media/${id}`;

/** How long an isolate reuses the list before reading it again. */
const CACHE_MS = 60_000;
let cache: { posts: BlogPost[]; expires: number } | undefined;

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  seo_title: string | null;
  seo_description: string | null;
  noindex: number;
  published_at: number;
  image_id: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  image_variants: string | null;
  og_image_id: string | null;
  author_name: string | null;
  author_role: string | null;
  author_bio: string | null;
};

type TermRow = {
  post_id: string;
  type: 'category' | 'tag';
  name: string;
  slug: string;
  description: string | null;
};

function cmsImage(row: PostRow, imageId: string) {
  const url = mediaUrl(imageId);
  const { srcset, smallUrl } = mediaSources(url, row.image_width, row.image_variants);
  return {
    url,
    alt: row.image_alt ?? '',
    width: row.image_width ?? undefined,
    height: row.image_height ?? undefined,
    cardUrl: smallUrl,
    srcset,
  };
}

const parseDoc = (json: string | null): RichTextDoc | null => {
  if (!json) return null;
  const doc: unknown = JSON.parse(json);
  return isAllowedRichText(doc) ? doc : null;
};

async function load(): Promise<BlogPost[]> {
  if (!db) return [];
  const [{ results: rows }, { results: terms }] = await Promise.all([
    db
      .prepare(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.body, p.seo_title, p.seo_description,
                p.noindex, p.published_at,
                fm.id AS image_id, fm.alt AS image_alt, fm.width AS image_width, fm.height AS image_height,
                fm.variants AS image_variants,
                p.og_media_id AS og_image_id,
                a.name AS author_name, a.role AS author_role, a.bio AS author_bio
         FROM posts p
         LEFT JOIN media fm ON fm.id = p.featured_media_id
         LEFT JOIN team_members a ON a.id = p.author_id AND a.deleted_at IS NULL
         WHERE p.status = 'published' AND p.deleted_at IS NULL
           AND p.published_at IS NOT NULL AND p.published_at <= ?`
      )
      .bind(Date.now())
      .all<PostRow>(),
    db
      .prepare(
        `SELECT pt.post_id, t.type, t.name, t.slug, t.description
         FROM post_terms pt JOIN terms t ON t.id = pt.term_id
         ORDER BY t.name`
      )
      .all<TermRow>(),
  ]);

  const termsByPost = new Map<string, TermRow[]>();
  for (const term of terms) {
    termsByPost.set(term.post_id, [...(termsByPost.get(term.post_id) ?? []), term]);
  }
  const toTerm = (t: TermRow): BlogTerm => ({
    slug: t.slug,
    title: t.name,
    description: t.description ?? undefined,
  });

  return rows.map((row): BlogPost => {
    const { html, headings, text } = renderRichText(parseDoc(row.body), {
      mediaOrigin: MEDIA_ORIGIN,
    });
    const postTerms = termsByPost.get(row.id) ?? [];
    const categories = postTerms.filter((t) => t.type === 'category').map(toTerm);
    const bio = richTextPlainText(parseDoc(row.author_bio)).trim();

    return {
      id: `cms:${row.id}`,
      source: 'cms',
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || undefined,
      publishedAt: new Date(row.published_at).toISOString(),
      seoTitle: row.seo_title || undefined,
      seoDescription: row.seo_description || undefined,
      noindex: row.noindex === 1,
      image: row.image_id ? cmsImage(row, row.image_id) : undefined,
      ogImageUrl: row.og_image_id ? mediaUrl(row.og_image_id) : undefined,
      category: categories[0],
      categories,
      tags: postTerms.filter((t) => t.type === 'tag').map(toTerm),
      author: row.author_name
        ? {
            slug: slugify(row.author_name),
            name: row.author_name,
            role: row.author_role ?? undefined,
            bio: bio || undefined,
          }
        : undefined,
      readingTime: getReadingTime(text),
      text,
      html,
      headings: headings.filter((h) => h.level === 2),
    };
  });
}

/** Every live CMS post, in no particular order. */
export async function getCmsPosts(): Promise<BlogPost[]> {
  if (cache && cache.expires > Date.now()) return cache.posts;
  try {
    const posts = await load();
    cache = { posts, expires: Date.now() + CACHE_MS };
    return posts;
  } catch (error) {
    // A database hiccup must not take the blog down; serve the last known
    // list, or none, and try again on the next request.
    console.error('[blog] could not load CMS posts', error);
    return cache?.posts ?? [];
  }
}

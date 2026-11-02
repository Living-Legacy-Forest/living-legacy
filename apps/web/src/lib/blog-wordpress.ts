/**
 * Posts still on the old WordPress site, read from its public REST API so they
 * can show on this blog without being copied across first. A post moved into
 * the CMS with the same slug replaces its WordPress copy (src/lib/blog-posts.ts).
 *
 * The whole list (about 130 posts, bodies included) is fetched in pages of 100
 * and kept per isolate for ten minutes. WordPress being slow or down must not
 * take the blog with it: the last good list is served, or none at all.
 */
import { slugify } from '@llf/content';
import { WORDPRESS_URL } from 'astro:env/server';
import { type BlogPost, type BlogTerm, getReadingTime } from '@/lib/blog';

const BASE = WORDPRESS_URL.replace(/\/+$/, '');
const API = `${BASE}/wp-json/wp/v2`;
const CACHE_MS = 10 * 60_000;
const PER_PAGE = 100;

let cache: { posts: BlogPost[]; expires: number } | undefined;
let pending: Promise<BlogPost[]> | undefined;

interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description?: string;
}

interface WpMedia {
  source_url?: string;
  alt_text?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url: string }>;
  };
}

interface WpPost {
  id: number;
  slug: string;
  date_gmt: string;
  sticky: boolean;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  tags: number[];
  yoast_head_json?: { description?: string };
  _embedded?: {
    author?: { name?: string; slug?: string; description?: string }[];
    'wp:featuredmedia'?: WpMedia[];
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

/** WordPress returns titles and excerpts with HTML entities ("&#8217;"). */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

const stripTags = (html: string) =>
  decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The post body made ready for this site: no scripts, links to other pages of
 * the old site made relative (the redirects take it from there), and ids on
 * H2/H3s so the table of contents can link to them.
 */
function prepareBody(html: string): { html: string; headings: { id: string; text: string }[] } {
  const headings: { id: string; text: string }[] = [];
  const usedIds = new Map<string, number>();
  const origin = BASE.replace(/^https?:\/\/(www\.)?/, '').replace(/[.]/g, '\\.');
  const ownLink = new RegExp(`href="https?://(?:www\\.)?${origin}(/(?!wp-content/)[^"]*)?"`, 'gi');

  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(ownLink, (_match, path: string | undefined) => `href="${path ?? '/'}"`)
    .replace(
      /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
      (_match, level: string, attrs: string, inner: string) => {
        const text = stripTags(inner);
        const existing = /\sid="([^"]+)"/.exec(attrs)?.[1];
        let id = existing ?? (slugify(text) || 'section');
        if (!existing) {
          const seen = usedIds.get(id) ?? 0;
          usedIds.set(id, seen + 1);
          if (seen > 0) id = `${id}-${seen + 1}`;
        }
        if (level === '2' && text) headings.push({ id, text });
        const rest = existing ? attrs : `${attrs} id="${id}"`;
        return `<h${level}${rest}>${inner}</h${level}>`;
      }
    );

  return { html: body, headings };
}

async function fetchJson<T>(path: string): Promise<{ data: T; totalPages: number }> {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return {
    data: (await response.json()) as T,
    totalPages: Number(response.headers.get('X-WP-TotalPages')) || 1,
  };
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const join = path.includes('?') ? '&' : '?';
  const first = await fetchJson<T[]>(`${path}${join}per_page=${PER_PAGE}&page=1`);
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) =>
      fetchJson<T[]>(`${path}${join}per_page=${PER_PAGE}&page=${i + 2}`)
    )
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

const POST_FIELDS = [
  'id',
  'slug',
  'date_gmt',
  'sticky',
  'title',
  'excerpt',
  'content',
  'categories',
  'tags',
  'yoast_head_json.description',
  '_links',
  '_embedded',
].join(',');

function toBlogPost(post: WpPost, terms: Map<number, BlogTerm>): BlogPost {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const author = post._embedded?.author?.[0];
  const { html, headings } = prepareBody(post.content.rendered);
  const text = stripTags(html);
  const categories = post.categories.flatMap((id) => terms.get(id) ?? []);
  const sizes = media?.media_details?.sizes;

  return {
    id: `wp:${post.id}`,
    source: 'wordpress',
    slug: post.slug,
    title: decodeEntities(post.title.rendered),
    excerpt: stripTags(post.excerpt.rendered).replace(/\s*\[…\]$/, '…') || undefined,
    publishedAt: new Date(`${post.date_gmt}Z`).toISOString(),
    isFeatured: post.sticky,
    seoDescription: post.yoast_head_json?.description || undefined,
    image: media?.source_url
      ? {
          url: sizes?.['2048x2048']?.source_url ?? sizes?.large?.source_url ?? media.source_url,
          alt: media.alt_text ?? '',
          width: media.media_details?.width,
          height: media.media_details?.height,
          cardUrl: sizes?.medium_large?.source_url ?? sizes?.large?.source_url,
        }
      : undefined,
    ogImageUrl: sizes?.large?.source_url,
    category: categories[0],
    categories,
    tags: post.tags.flatMap((id) => terms.get(id) ?? []),
    author:
      author?.name && author.slug
        ? { slug: author.slug, name: author.name, bio: author.description || undefined }
        : undefined,
    readingTime: getReadingTime(text),
    text,
    html,
    headings,
  };
}

/**
 * The WordPress site has dozens of published "posts" titled "cache" (slugs
 * cache, cache-2, …), each just an embed of a real post. They are left over
 * by a plugin, not articles, and must not show as blog posts.
 */
const isCacheStub = (post: WpPost) =>
  /^cache(-\d+)?$/.test(post.slug) && decodeEntities(post.title.rendered).trim() === 'cache';

async function load(): Promise<BlogPost[]> {
  const [posts, categories, tags] = await Promise.all([
    fetchAllPages<WpPost>(`/posts?_embed=author,wp:featuredmedia&_fields=${POST_FIELDS}`),
    fetchAllPages<WpTerm>('/categories?_fields=id,slug,name,description&hide_empty=true'),
    fetchAllPages<WpTerm>('/tags?_fields=id,slug,name&hide_empty=true'),
  ]);
  const terms = new Map<number, BlogTerm>(
    [...categories, ...tags].map((t) => [
      t.id,
      { slug: t.slug, title: decodeEntities(t.name), description: t.description || undefined },
    ])
  );
  return posts.filter((post) => !isCacheStub(post)).map((post) => toBlogPost(post, terms));
}

/** Every published post on the WordPress site, newest first. */
export async function getWordPressPosts(): Promise<BlogPost[]> {
  if (cache && cache.expires > Date.now()) return cache.posts;
  // One fetch at a time: concurrent requests on a cold isolate share it.
  pending ??= load()
    .then((posts) => {
      cache = { posts, expires: Date.now() + CACHE_MS };
      return posts;
    })
    .catch((error: unknown) => {
      console.error('[blog] could not load WordPress posts', error);
      // Retry in a minute rather than on every request while it is down.
      cache = { posts: cache?.posts ?? [], expires: Date.now() + 60_000 };
      return cache.posts;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

/**
 * Move the blog from WordPress into Sanity.
 *
 * The live site's blog is WordPress at livinglegacyforest.com. The rebuilt
 * site reads its blog from Sanity project 6nf0cv12 instead, so this moves the
 * 21 real posts across. WordPress also reports 81 auto-generated oEmbed cache
 * posts (slug `cache-N`, title "cache", body a single embed blockquote) mixed
 * into the same collection; those are not content and are skipped.
 *
 * Idempotent. Documents are addressed by a deterministic id derived from the
 * WordPress slug and written with createOrReplace, so a second run updates in
 * place rather than duplicating. Images are content-addressed by their source
 * URL and skipped if already uploaded. A failed run can simply be run again.
 * `wpId` is also stamped onto every migrated post, so a document written by
 * this script can always be found again even if its slug changes later.
 *
 * Dry run by default. `--write` is required to touch the dataset, because the
 * token this needs is a write token and the blast radius is the production
 * dataset.
 *
 *   pnpm blog:migrate              # convert everything, write nothing, report
 *   pnpm blog:migrate --write      # actually write
 *   pnpm blog:migrate --limit 3    # first three posts only, for a look
 *
 * Needs SANITY_WRITE_TOKEN and SANITY_PROJECT_ID in the environment; the npm
 * script loads them from .env if present. Never commit the token.
 */
import { createClient } from '@sanity/client';
import { htmlToBlocks, type DeserializerRule } from '@portabletext/block-tools';
import { Schema } from '@sanity/schema';
import { JSDOM } from 'jsdom';
// jsdom bundles its own, differently-versioned copy of undici. Importing it
// registers that copy as Node's global fetch dispatcher (both versions share
// the same well-known `Symbol.for('undici.globalDispatcher.1')` on
// `globalThis`), and the resulting cross-version wrapper silently drops the
// `content-encoding` header on a brotli response while leaving the compressed
// bytes in place — `fetch(...).json()` then fails on gibberish. Importing
// `fetch` explicitly from this project's own `undici` dependency sidesteps
// that shared global entirely, so it is used for every network call below
// instead of the ambient global `fetch`.
import { fetch } from 'undici';

// Imported file by file rather than through schemaTypes/index.ts, which uses
// extensionless specifiers that Vite resolves for the app and plain Node does
// not. These are the real schema definitions the studio uses, so the body
// type deserialized into below cannot drift from what an editor sees.
import { author } from '../src/sanity/schemaTypes/author.ts';
import { blog } from '../src/sanity/schemaTypes/blog.ts';
import { category } from '../src/sanity/schemaTypes/category.ts';
import { tag } from '../src/sanity/schemaTypes/tag.ts';
import {
  collectImageUrls,
  decodeEntities,
  normaliseBodyHeadings,
  stripNonContentElements,
  toRelativeInternalLinks,
  widestFromSrcset,
} from './lib/wp-blog-html.ts';

const WP_SITE = process.env.WP_SITE_URL ?? 'https://livinglegacyforest.com';
// Both the WordPress host and the domain the rebuilt site publishes under are
// rewritten to root-relative — an internal link in a post body might point at
// either one on the live site.
const WP_HOSTS = ['livinglegacyforest.com', 'livinglegacy.com.au'];

const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET ?? 'production';
const API_VERSION = process.env.SANITY_API_VERSION ?? '2026-05-25';
const TOKEN = process.env.SANITY_WRITE_TOKEN;

/** The one byline every post on this blog carries. */
const AUTHOR = {
  _id: 'author-warren',
  name: 'Warren Roberts',
  slug: 'warren',
  bio: 'Founder of Living Legacy Memorial Gardens, writing about natural burial options and environmental conservation in Australia.',
};

/**
 * WordPress's catch-all term, kept only when a post has nothing else. Not hit
 * by the current 21 posts (all filed under "Legacy Advice"), kept for
 * whatever the live site publishes next.
 */
const CATCH_ALL_CATEGORY = 'uncategorized';

const WRITE = process.argv.includes('--write');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i === -1 ? Infinity : Number.parseInt(process.argv[i + 1] ?? '', 10) || Infinity;
})();

// ---------------------------------------------------------------------------
// Shapes we care about from the WordPress REST API
// ---------------------------------------------------------------------------

interface WpRendered {
  rendered: string;
}
interface WpTerm {
  name: string;
  slug: string;
  taxonomy: string;
}
interface WpMedia {
  source_url?: string;
  alt_text?: string;
}
interface WpPost {
  id: number;
  slug: string;
  status: string;
  date_gmt: string;
  modified_gmt: string;
  title: WpRendered;
  excerpt: WpRendered;
  content: WpRendered;
  sticky?: boolean;
  yoast_head_json?: { title?: string; description?: string };
  _embedded?: {
    'wp:term'?: WpTerm[][];
    'wp:featuredmedia'?: WpMedia[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const slugify = (text: string): string =>
  decodeEntities(text)
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/** Strip tags and collapse whitespace, for excerpts and alt text. */
const toPlainText = (html: string): string =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Keys have to be stable across runs, or every re-run rewrites every block
 * with new ones and the document history fills with diffs that changed
 * nothing. A counter per document gives the same keys for the same input.
 */
function makeKeyGenerator(): () => string {
  let n = 0;
  return () => `k${(n += 1)}`;
}

const client = createClient({
  projectId: PROJECT_ID ?? 'placeholder',
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * WordPress reports 102 posts across two pages, 81 of which are the
 * auto-generated `cache-N` oEmbed stubs (empty title "cache", a single embed
 * blockquote for a body). Those are skipped here so nothing downstream has to
 * know they exist.
 */
async function fetchAllPosts(): Promise<WpPost[]> {
  const posts: WpPost[] = [];
  for (let page = 1; ; page += 1) {
    const url = `${WP_SITE}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=1`;
    const response = await fetch(url);
    if (response.status === 400) break; // past the last page
    if (!response.ok) throw new Error(`WordPress returned ${response.status} for ${url}`);
    const batch = (await response.json()) as WpPost[];
    if (batch.length === 0) break;
    posts.push(...batch);
    const total = Number.parseInt(response.headers.get('x-wp-totalpages') ?? '1', 10);
    if (page >= total) break;
  }
  return posts.filter((p) => p.status === 'publish' && !p.slug.startsWith('cache') && p.slug);
}

// ---------------------------------------------------------------------------
// Image assets
// ---------------------------------------------------------------------------

/**
 * Upload one image and return its asset id, reusing an existing upload when
 * the same source URL has been seen before.
 *
 * The originating URL is stored on the asset so a re-run can find it again.
 * Without that, "have I uploaded this already?" has no answer and every run
 * would add another copy of every image.
 */
async function uploadImage(
  url: string,
  cache: Map<string, string>,
  stats: { uploaded: number; reused: number; failed: string[] }
): Promise<string | null> {
  const cached = cache.get(url);
  if (cached) {
    stats.reused += 1;
    return cached;
  }

  if (!WRITE) {
    // In a dry run there is no asset to point at, but the caller still needs
    // a truthy id to build a representative document.
    cache.set(url, 'image-DRYRUN');
    return 'image-DRYRUN';
  }

  try {
    const existing = await client.fetch<{ _id: string } | null>(
      `*[_type == "sanity.imageAsset" && source.url == $url][0]{_id}`,
      { url }
    );
    if (existing?._id) {
      cache.set(url, existing._id);
      stats.reused += 1;
      return existing._id;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} fetching image`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'image');

    const asset = await client.assets.upload('image', buffer, {
      filename,
      source: { name: 'wordpress', id: url, url },
    });

    cache.set(url, asset._id);
    stats.uploaded += 1;
    return asset._id;
  } catch (error) {
    stats.failed.push(`${url}: ${(error as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML to Portable Text
// ---------------------------------------------------------------------------

/**
 * Sanity's built-in `image` type resolves `sanity.imageHotspot` and
 * `sanity.imageCrop` lazily, and those are registered by the studio rather
 * than by a bare Schema.compile. Walking the compiled type therefore throws
 * "Unknown type: sanity.imageHotspot" the moment block-tools reads it.
 *
 * Hotspot and crop are studio cropping affordances and mean nothing to
 * deserialization, which only needs to know that a member called `image` is
 * allowed in the array. So in this copy, and only this copy, every `image`
 * becomes a plain object of the same name. The documents written to Sanity
 * are built by the rules below and still carry a real `_type: 'image'` with
 * an asset reference, so what lands in the dataset is a genuine Sanity image.
 */
function forDeserialization<T>(node: T): T {
  if (Array.isArray(node)) return node.map(forDeserialization) as T;
  if (node && typeof node === 'object') {
    const source = node as Record<string, unknown>;
    if (source.type === 'image') {
      const fields = (source.fields as unknown[] | undefined) ?? [];
      return {
        ...source,
        name: (source.name as string | undefined) ?? 'image',
        type: 'object',
        options: undefined,
        fields: [...(fields as Array<Record<string, unknown>>).map(forDeserialization)],
      } as T;
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) out[key] = forDeserialization(value);
    return out as T;
  }
  return node;
}

const schema = Schema.compile({
  name: 'default',
  types: forDeserialization([blog, author, category, tag]),
});
const bodyType = schema.get('blog').fields.find((f: { name: string }) => f.name === 'body')?.type;

if (!bodyType) throw new Error('The compiled blog type has no body field to deserialize into.');

/**
 * Rules that map the markup the schema has a home for.
 *
 * Anything not matched here falls through to block-tools' defaults, which
 * handle paragraphs, headings, lists, emphasis and links. The rules below
 * exist because images and tables produce objects rather than text, so the
 * default would drop them or flatten them to their alt attribute.
 */
function buildRules(assets: Map<string, string>): DeserializerRule[] {
  return [
    // Images. `figure` is matched rather than `img` so a caption travels with
    // its picture; a bare `img` is handled by the second rule.
    {
      deserialize(node, _next, block) {
        const el = node as Element;
        if (el.nodeName?.toLowerCase() !== 'figure') return undefined;
        const img = el.querySelector?.('img');
        if (!img) return undefined;
        const src = widestFromSrcset(img.getAttribute('srcset'), img.getAttribute('src') ?? '');
        const assetId = assets.get(src);
        if (!assetId) return undefined;
        const caption = toPlainText(el.querySelector?.('figcaption')?.innerHTML ?? '');
        return block({
          _type: 'image',
          asset: { _type: 'reference', _ref: assetId },
          // The schema makes alt required. WordPress alt is frequently
          // empty, so a caption is the next best real description; the
          // filename is never used, since "IMG_4021" describes nothing.
          alt: toPlainText(img.getAttribute('alt') ?? '') || caption || 'Living Legacy',
          ...(caption ? { caption } : {}),
        });
      },
    },
    {
      deserialize(node, _next, block) {
        const el = node as Element;
        if (el.nodeName?.toLowerCase() !== 'img') return undefined;
        const src = widestFromSrcset(el.getAttribute('srcset'), el.getAttribute('src') ?? '');
        const assetId = assets.get(src);
        if (!assetId) return undefined;
        return block({
          _type: 'image',
          asset: { _type: 'reference', _ref: assetId },
          alt: toPlainText(el.getAttribute('alt') ?? '') || 'Living Legacy',
        });
      },
    },
    // Tables. The schema stores rows as pipe-delimited strings rather than
    // nested arrays, so the cells are joined here to match. Only one of the
    // 21 posts has one (an Elementor data-table widget), but the rule is
    // general.
    {
      deserialize(node, _next, block) {
        const el = node as Element;
        if (el.nodeName?.toLowerCase() !== 'table') return undefined;
        const rows = [...(el.querySelectorAll?.('tr') ?? [])].map((tr) => ({
          _type: 'tableRow',
          cells: [...tr.querySelectorAll('th, td')].map(cellText).join(' | '),
        }));
        if (rows.length === 0) return undefined;
        const hasHeader = Boolean(el.querySelector?.('th'));
        return block({ _type: 'table', hasHeader, rows });
      },
    },
  ];
}

/**
 * One table cell as text, keeping any destination its links carried.
 *
 * A cell is a plain string in this schema, so an `<a>` inside one cannot stay
 * a link. Flattening it to its anchor text alone would lose the URL outright,
 * so the href is appended in brackets, which the table renderer prints as
 * ordinary text. Skipped when the URL is already the visible text.
 */
function cellText(cell: Element): string {
  const text = toPlainText(cell.innerHTML);
  const hrefs = [...(cell.querySelectorAll?.('a[href]') ?? [])]
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href && !href.startsWith('#') && !text.includes(href));

  if (hrefs.length === 0) return text;
  return `${text} (${[...new Set(hrefs)].join(', ')})`.trim();
}

interface ConversionNotes {
  imagesLinked: number;
  imagesUnresolved: number;
}

function convertBody(
  html: string,
  title: string,
  assets: Map<string, string>,
  notes: ConversionNotes
): unknown[] {
  const cleaned = normaliseBodyHeadings(stripNonContentElements(html), title);

  const blocks = htmlToBlocks(cleaned, bodyType, {
    parseHtml: (input: string) => new JSDOM(input).window.document,
    keyGenerator: makeKeyGenerator(),
    rules: buildRules(assets),
  }) as Array<Record<string, unknown>>;

  for (const block of blocks) {
    if (block._type === 'image') notes.imagesLinked += 1;

    // Rewrite internal links so a migrated post stops sending readers back to
    // the WordPress site this one replaces.
    const markDefs = block.markDefs as Array<Record<string, unknown>> | undefined;
    for (const def of markDefs ?? []) {
      if (typeof def.href === 'string') def.href = toRelativeInternalLinks(def.href, WP_HOSTS);
    }
  }

  // Empty paragraphs are Elementor spacing, not writing.
  return blocks.filter((block) => {
    if (block._type !== 'block') return true;
    const children = (block.children ?? []) as Array<{ text?: string }>;
    return children.some((child) => (child.text ?? '').trim().length > 0);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!PROJECT_ID) {
    console.error('SANITY_PROJECT_ID is not set. Source .env first.');
    process.exitCode = 1;
    return;
  }
  if (WRITE && !TOKEN) {
    console.error('--write needs SANITY_WRITE_TOKEN in the environment.');
    process.exitCode = 1;
    return;
  }

  console.log(`${WRITE ? 'WRITING to' : 'Dry run against'} ${PROJECT_ID}/${DATASET}\n`);

  const allPosts = await fetchAllPosts();
  const posts = allPosts.slice(0, LIMIT);
  console.log(
    `WordPress returned ${allPosts.length} real posts (cache-* stubs already excluded)` +
      (posts.length !== allPosts.length ? `, taking ${posts.length}` : '')
  );

  // --- taxonomy -----------------------------------------------------------
  const categories = new Map<string, { _id: string; title: string; slug: string }>();
  const tags = new Map<string, { _id: string; title: string; slug: string }>();

  for (const post of posts) {
    for (const group of post._embedded?.['wp:term'] ?? []) {
      for (const term of group) {
        const title = decodeEntities(term.name);
        const slug = term.slug || slugify(title);
        if (term.taxonomy === 'category') {
          categories.set(slug, { _id: `category-${slug}`, title, slug });
        } else if (term.taxonomy === 'post_tag') {
          tags.set(slug, { _id: `tag-${slug}`, title, slug });
        }
      }
    }
  }

  console.log(`categories: ${[...categories.values()].map((c) => c.title).join(', ')}`);
  console.log(`tags: ${[...tags.values()].map((t) => t.title).join(', ')}`);
  console.log(`byline: ${AUTHOR.name}\n`);

  // --- images -------------------------------------------------------------
  const assetCache = new Map<string, string>();
  const imageStats = { uploaded: 0, reused: 0, failed: [] as string[] };

  const bodyUrls = new Set<string>();
  for (const post of posts)
    for (const u of collectImageUrls(post.content.rendered)) bodyUrls.add(u);

  const featuredUrls = new Map<number, { url: string; alt: string }>();
  for (const post of posts) {
    const media = post._embedded?.['wp:featuredmedia']?.[0];
    const url = media?.source_url;
    if (!url) continue;
    featuredUrls.set(post.id, { url, alt: toPlainText(media?.alt_text ?? '') });
    bodyUrls.add(url);
  }

  console.log(`images referenced: ${bodyUrls.size} distinct`);
  let done = 0;
  for (const url of bodyUrls) {
    await uploadImage(url, assetCache, imageStats);
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${bodyUrls.size}`);
  }
  console.log(
    `images: ${imageStats.uploaded} uploaded, ${imageStats.reused} already present, ` +
      `${imageStats.failed.length} failed\n`
  );

  // --- documents ----------------------------------------------------------
  const docs: Array<Record<string, unknown>> = [];
  const report: Array<Record<string, unknown>> = [];

  for (const [slug, cat] of categories) {
    docs.push({
      _id: cat._id,
      _type: 'category',
      title: cat.title,
      slug: { _type: 'slug', current: slug },
    });
  }
  for (const [slug, t] of tags) {
    docs.push({
      _id: t._id,
      _type: 'tag',
      title: t.title,
      slug: { _type: 'slug', current: slug },
    });
  }
  docs.push({
    _id: AUTHOR._id,
    _type: 'author',
    name: AUTHOR.name,
    slug: { _type: 'slug', current: AUTHOR.slug },
    bio: AUTHOR.bio,
  });

  for (const post of posts) {
    const notes: ConversionNotes = { imagesLinked: 0, imagesUnresolved: 0 };
    const postTitle = decodeEntities(post.title.rendered);
    const body = convertBody(post.content.rendered, postTitle, assetCache, notes);

    const terms = (post._embedded?.['wp:term'] ?? []).flat();
    const allCategories = terms
      .filter((t) => t.taxonomy === 'category')
      .map((t) => t.slug || slugify(decodeEntities(t.name)));
    const postTags = terms
      .filter((t) => t.taxonomy === 'post_tag')
      .map((t) => t.slug || slugify(decodeEntities(t.name)));

    // Drop the catch-all when the post has a real category to show instead.
    const realCategories = allCategories.filter((c) => c !== CATCH_ALL_CATEGORY);
    const postCategories = realCategories.length > 0 ? realCategories : allCategories;

    const featured = featuredUrls.get(post.id);
    const featuredAssetId = featured ? assetCache.get(featured.url) : undefined;

    const doc: Record<string, unknown> = {
      _id: `blog-${post.slug}`,
      _type: 'blog',
      title: postTitle,
      slug: { _type: 'slug', current: post.slug },
      publishedAt: new Date(`${post.date_gmt}Z`).toISOString(),
      updatedAt: new Date(`${post.modified_gmt}Z`).toISOString(),
      wpId: post.id,
      // The schema requires at least one, and this migration invents nothing
      // around a post with none: it carries across whatever WordPress says,
      // which shows up in the studio for an editor to correct.
      categories: postCategories.map((c, i) => ({
        _key: `c${i + 1}`,
        _type: 'reference',
        _ref: `category-${c}`,
      })),
      tags: postTags.map((t, i) => ({
        _key: `t${i + 1}`,
        _type: 'reference',
        _ref: `tag-${t}`,
      })),
      author: { _type: 'reference', _ref: AUTHOR._id },
      isFeatured: Boolean(post.sticky),
      excerpt: toPlainText(post.excerpt.rendered),
      body,
    };

    const yoastTitle = post.yoast_head_json?.title;
    const yoastDescription = post.yoast_head_json?.description;
    if (yoastTitle) doc.seoTitle = yoastTitle;
    if (yoastDescription) doc.seoDescription = yoastDescription;

    if (featuredAssetId) {
      doc.featuredImage = {
        _type: 'image',
        asset: { _type: 'reference', _ref: featuredAssetId },
        alt: featured?.alt || postTitle,
      };
    }

    docs.push(doc);
    report.push({
      slug: post.slug,
      blocks: body.length,
      images: notes.imagesLinked,
      tags: postTags.length,
      categories: postCategories.length,
      featuredImage: Boolean(featuredAssetId),
      uncategorised: postCategories.includes(CATCH_ALL_CATEGORY),
      words: body
        .filter((b) => (b as Record<string, unknown>)._type === 'block')
        .flatMap((b) => ((b as Record<string, unknown>).children ?? []) as Array<{ text?: string }>)
        .map((c) => c.text ?? '')
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length,
    });
  }

  // --- write --------------------------------------------------------------
  if (WRITE) {
    const tx = docs.reduce((t, doc) => t.createOrReplace(doc as never), client.transaction());
    await tx.commit();
    console.log(`committed ${docs.length} documents\n`);
  } else {
    console.log(
      `would write ${docs.length} documents (${posts.length} posts, ` +
        `${categories.size} categories, ${tags.size} tags, 1 author)\n`
    );
  }

  // --- report -------------------------------------------------------------
  console.table(report);

  const uncategorised = report.filter((r) => r.uncategorised);
  if (uncategorised.length) {
    console.warn(
      `\nStill filed only under WordPress's catch-all, and the category is ` +
        `printed on the card, so these want a real one in the studio:\n  ` +
        uncategorised.map((r) => r.slug).join('\n  ')
    );
  }

  const empty = report.filter((r) => (r.blocks as number) === 0);
  const thin = report.filter((r) => (r.words as number) < 100);
  if (empty.length) console.error(`\nEMPTY BODIES: ${empty.map((r) => r.slug).join(', ')}`);
  if (thin.length)
    console.warn(`\nUnder 100 words, worth an eye: ${thin.map((r) => r.slug).join(', ')}`);
  if (imageStats.failed.length) {
    console.error(`\nImage failures:`);
    for (const f of imageStats.failed) console.error(`  ${f}`);
  }

  const totalWords = report.reduce((sum, r) => sum + (r.words as number), 0);
  console.log(
    `\n${report.length} posts, ${totalWords.toLocaleString()} words, ` +
      `${report.reduce((s, r) => s + (r.images as number), 0)} body images`
  );
  if (!WRITE) console.log('\nDry run. Re-run with --write to commit.');
}

await main();

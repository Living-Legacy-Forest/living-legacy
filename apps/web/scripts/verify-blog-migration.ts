/**
 * Check that the migration did not quietly lose writing.
 *
 * Counting documents proves nothing: a post that arrives with its body
 * reduced to a headline is still a document. This compares the prose
 * actually in WordPress against the prose actually in Portable Text, word for
 * word, and reports the ratio.
 *
 * The comparison is deliberately made against the *cleaned* source, the same
 * HTML the converter sees, because furniture markup stripped before
 * conversion is not writing and counting it would make every affected post
 * look like it had lost a chunk of itself it never had.
 *
 *   pnpm blog:verify
 */
import { createClient } from '@sanity/client';
import { JSDOM } from 'jsdom';
// See the matching comment in migrate-blog-to-sanity.ts: importing jsdom
// hijacks Node's global fetch dispatcher and silently corrupts brotli
// responses, so every network call here goes through this project's own
// `undici` dependency instead of the ambient global `fetch`.
import { fetch } from 'undici';

import {
  decodeEntities,
  normaliseBodyHeadings,
  stripNonContentElements,
} from './lib/wp-blog-html.ts';

const WP_SITE = process.env.WP_SITE_URL ?? 'https://livinglegacyforest.com';
const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET ?? 'production';
const API_VERSION = process.env.SANITY_API_VERSION ?? '2026-05-25';

/** Below this share of the source's words, a post is treated as suspect. */
const FLOOR = 0.85;

const client = createClient({
  projectId: PROJECT_ID ?? 'placeholder',
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

const words = (text: string): string[] =>
  decodeEntities(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

/** Prose only: tags out, entities decoded, whitespace collapsed. */
function sourceWords(html: string): string[] {
  return words(stripNonContentElements(html).replace(/<[^>]*>/g, ' '));
}

interface PortableBlock {
  _type: string;
  style?: string;
  listItem?: string;
  markDefs?: Array<{ _type?: string; _key?: string }>;
  children?: Array<{ text?: string; marks?: string[] }>;
  rows?: Array<{ cells?: string }>;
  caption?: string;
}

interface WpPostSummary {
  id: number;
  slug: string;
  status: string;
  title: { rendered: string };
  content: { rendered: string };
}

async function fetchAllPosts(): Promise<WpPostSummary[]> {
  const posts: WpPostSummary[] = [];
  for (let page = 1; ; page += 1) {
    const url = `${WP_SITE}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,slug,status,title,content`;
    const response = await fetch(url);
    if (response.status === 400) break;
    if (!response.ok) throw new Error(`WordPress returned ${response.status} for ${url}`);
    const batch = (await response.json()) as WpPostSummary[];
    if (batch.length === 0) break;
    posts.push(...batch);
    const total = Number.parseInt(response.headers.get('x-wp-totalpages') ?? '1', 10);
    if (page >= total) break;
  }
  return posts.filter((p) => p.status === 'publish' && !p.slug.startsWith('cache') && p.slug);
}

/**
 * Every word the document holds, wherever it lives.
 *
 * Counting only `_type == "block"` would be wrong here and wrong in a way
 * that looks like data loss: the one post with a table has its prose land in
 * a `table` object rather than in blocks, so it would report a shortfall it
 * has not got. Captions are counted for the same reason.
 */
function bodyWords(body: PortableBlock[] | undefined): string[] {
  const parts: string[] = [];
  for (const block of body ?? []) {
    if (block._type === 'block') {
      parts.push((block.children ?? []).map((c) => c.text ?? '').join(' '));
    } else if (block._type === 'table') {
      parts.push((block.rows ?? []).map((r) => (r.cells ?? '').replace(/\|/g, ' ')).join(' '));
    } else if (block.caption) {
      parts.push(block.caption);
    }
  }
  return words(parts.join(' '));
}

/**
 * Compare the shape of the article, not just its wording.
 *
 * A body can keep every word and still arrive broken: headings deserialized
 * as ordinary paragraphs read identically to a word counter and destroy the
 * table of contents, and a link whose href was dropped still contributes its
 * anchor text. So headings, list items, links and images are counted on both
 * sides.
 *
 * The source side is parsed rather than pattern-matched, because this markup
 * is not always well formed and a regex counts tags a parser never turns into
 * elements.
 */
function compareStructure(
  html: string,
  title: string,
  body: PortableBlock[] | undefined
): Record<string, string> | null {
  const cleaned = normaliseBodyHeadings(stripNonContentElements(html), title);
  const { document } = new JSDOM(cleaned).window;

  const sourceHeadings = [...document.querySelectorAll('h2, h3, h4')].filter(
    (h) => (h.textContent ?? '').trim().length > 0 && !h.querySelector('p, div, ul, ol')
  ).length;

  const sourceListItems = [...document.querySelectorAll('li')].filter((li) => {
    const own = li.cloneNode(true) as Element;
    for (const nested of own.querySelectorAll('ul, ol')) nested.remove();
    return (own.textContent ?? '').trim().length > 0;
  }).length;
  const sourceImages = document.querySelectorAll('img').length;
  const sourceLinks = [...document.querySelectorAll('a[href]')].filter((a) => {
    if (a.closest('table')) return false;
    if (a.querySelector('img')) return false;
    return !/\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(a.getAttribute('href') ?? '');
  }).length;

  const blocks = body ?? [];
  const migratedHeadings = blocks.filter(
    (b) => b._type === 'block' && ['h2', 'h3', 'h4'].includes(b.style ?? '')
  ).length;
  const migratedListItems = blocks.filter((b) => b._type === 'block' && b.listItem).length;
  const migratedLinks = blocks
    .filter((b) => b._type === 'block')
    .reduce((sum, b) => {
      const linkKeys = new Set(
        (b.markDefs ?? []).filter((d) => d._type === 'link').map((d) => d._key)
      );
      return (
        sum + (b.children ?? []).filter((c) => (c.marks ?? []).some((m) => linkKeys.has(m))).length
      );
    }, 0);
  const migratedImages = blocks.filter((b) => b._type === 'image').length;

  const issues: Record<string, string> = {};
  const check = (name: string, from: number, to: number) => {
    if (to < from) issues[name] = `${from} -> ${to}`;
  };
  check('headings', sourceHeadings, migratedHeadings);
  check('listItems', sourceListItems, migratedListItems);
  check('links', sourceLinks, migratedLinks);
  check('images', sourceImages, migratedImages);

  return Object.keys(issues).length > 0 ? issues : null;
}

async function main() {
  if (!PROJECT_ID) {
    console.error('SANITY_PROJECT_ID is not set. Source .env first.');
    process.exitCode = 1;
    return;
  }

  const wpPosts = await fetchAllPosts();

  const docs = await client.fetch<
    Array<{
      slug: string;
      title: string;
      body?: PortableBlock[];
      hasImage: boolean;
      cats: number;
      tagCount: number;
    }>
  >(
    `*[_type == "blog"]{"slug": slug.current, title, body,
       "hasImage": defined(featuredImage.asset), "cats": count(categories), "tagCount": count(tags)}`
  );
  const bySlug = new Map(docs.map((d) => [d.slug, d]));

  console.log(`WordPress: ${wpPosts.length} real posts (cache-* stubs excluded)`);
  console.log(`Sanity:    ${docs.length} blog documents\n`);

  const missing: string[] = [];
  const thin: Array<{ slug: string; source: number; migrated: number; ratio: string }> = [];
  const noImage: string[] = [];
  const noCategory: string[] = [];
  const structural: Array<Record<string, unknown>> = [];
  let sourceTotal = 0;
  let migratedTotal = 0;

  for (const post of wpPosts) {
    const doc = bySlug.get(post.slug);
    if (!doc) {
      missing.push(post.slug);
      continue;
    }
    const source = sourceWords(post.content.rendered).length;
    const migrated = bodyWords(doc.body).length;
    sourceTotal += source;
    migratedTotal += migrated;

    const ratio = source === 0 ? 1 : migrated / source;
    if (ratio < FLOOR) {
      thin.push({ slug: post.slug, source, migrated, ratio: `${(ratio * 100).toFixed(0)}%` });
    }
    if (!doc.hasImage) noImage.push(post.slug);
    if (!doc.cats) noCategory.push(post.slug);

    const shape = compareStructure(post.content.rendered, post.title.rendered, doc.body);
    if (shape) structural.push({ slug: post.slug, ...shape });
  }

  const extra = docs.filter((d) => !wpPosts.some((p) => p.slug === d.slug));

  console.log(
    `prose: ${sourceTotal.toLocaleString()} words in WordPress, ` +
      `${migratedTotal.toLocaleString()} in Sanity ` +
      `(${sourceTotal === 0 ? '—' : ((migratedTotal / sourceTotal) * 100).toFixed(1) + '%'})\n`
  );

  let failed = false;

  if (missing.length) {
    failed = true;
    console.error(`NOT MIGRATED (${missing.length}):`);
    for (const s of missing) console.error(`  ${s}`);
  }
  if (thin.length) {
    failed = true;
    console.error(`\nBODY SHORTER THAN ${FLOOR * 100}% OF SOURCE (${thin.length}):`);
    console.table(thin);
  }
  if (noImage.length) {
    failed = true;
    console.error(`\nNO FEATURED IMAGE (${noImage.length}): ${noImage.join(', ')}`);
  }
  if (noCategory.length) {
    failed = true;
    console.error(`\nNO CATEGORY (${noCategory.length}): ${noCategory.join(', ')}`);
  }
  if (extra.length) {
    // Not a failure. A post can be deleted in WordPress and still be wanted
    // here, and this is the only place that difference is visible.
    console.warn(
      `\nIn Sanity but not in WordPress (${extra.length}): ${extra.map((d) => d.slug).join(', ')}`
    );
  }

  if (structural.length) {
    failed = true;
    console.error(`\nSTRUCTURE LOST (${structural.length}):`);
    console.table(structural);
  }

  if (!failed) {
    console.log(
      'All posts present, with their prose, headings, lists, links and images intact,\n' +
        'and each with a category and a featured image.'
    );
  } else process.exitCode = 1;
}

await main();

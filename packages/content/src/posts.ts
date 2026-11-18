import { z } from 'zod';
import { isVideoRef } from './video-embed';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;
export const FOCUS_KEYWORD_LIMIT = 80;
export const RELATED_TERM_LIMIT = 60;
export const RELATED_TERMS_MAX = 10;

/** Keeps the first of terms that differ only in case. */
export function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = term.toLocaleLowerCase('en-AU');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Public URL path of a blog post on the website. */
export const blogPath = (slug: string) => `/blog/${slug}`;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

// Rich text is stored as Tiptap JSON. Only what the editor can produce is
// accepted, so a crafted request cannot store arbitrary nodes or links.
const allowedNodes = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
  'image',
  'videoEmbed',
]);
const allowedMarks = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'highlight',
  'textStyle',
  'subscript',
  'superscript',
]);

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type RichTextNode = {
  type: string;
  content?: RichTextNode[];
  marks?: { type: string; attrs?: Record<string, JsonValue> }[];
  attrs?: Record<string, JsonValue>;
  text?: string;
};
export type RichTextDoc = RichTextNode & { type: 'doc' };

const isSafeHref = (href: unknown) =>
  typeof href === 'string' && !/^\s*(javascript|data|vbscript):/i.test(href);

// Images must be hosted (https, or a site path such as /media/...). Embedded
// data: URIs would bloat the database and skip the media library.
const isHostedImage = (src: unknown) =>
  typeof src === 'string' && (/^https:\/\//i.test(src) || /^\/(?!\/)/.test(src));

// Far beyond anything the editor makes (a list ten deep is rare), but low
// enough that a crafted document cannot exhaust the stack or the CPU of the
// server checking it here and rendering it on the website.
const MAX_DEPTH = 40;
const MAX_NODES = 20_000;

function isAllowedNode(node: unknown, depth: number, budget: { nodes: number }): boolean {
  if (!node || typeof node !== 'object') return false;
  if (depth > MAX_DEPTH || --budget.nodes < 0) return false;
  const { type, content, marks, attrs } = node as RichTextNode;
  if (typeof type !== 'string' || !allowedNodes.has(type)) return false;
  if (type === 'image' && !isHostedImage(attrs?.src)) return false;
  if (type === 'videoEmbed' && !isVideoRef(attrs)) return false;
  if (content !== undefined) {
    if (!Array.isArray(content)) return false;
    for (const child of content) if (!isAllowedNode(child, depth + 1, budget)) return false;
  }
  if (marks !== undefined) {
    if (!Array.isArray(marks)) return false;
    for (const mark of marks) {
      if (!mark || !allowedMarks.has(mark.type)) return false;
      if (mark.type === 'link' && !isSafeHref(mark.attrs?.href)) return false;
    }
  }
  return true;
}

export function isAllowedRichText(value: unknown): value is RichTextDoc {
  return (
    (value as RichTextNode | null)?.type === 'doc' && isAllowedNode(value, 0, { nodes: MAX_NODES })
  );
}

export const richTextSchema = z.custom<RichTextDoc>(isAllowedRichText, {
  message: 'The content contains something the editor does not support.',
});

export const postInputSchema = z.object({
  title: z.string().trim().max(200),
  // Empty is allowed while drafting; the server derives one from the title.
  slug: z
    .string()
    .trim()
    .max(100)
    .refine((slug) => slug === '' || SLUG_PATTERN.test(slug), {
      message: 'Use lowercase letters, numbers and hyphens only.',
    }),
  excerpt: z.string().trim().max(500),
  body: richTextSchema.nullable(),
  authorId: z.string().nullable(),
  /** The forest the post is about, if any. Defaults keep older drafts and revisions readable. */
  locationId: z.string().nullable().default(null),
  categoryIds: z.array(z.string()).max(20),
  /** Tag names; unknown tags are created on save. */
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  featuredMediaId: z.string().nullable(),
  seoTitle: z.string().trim().max(120),
  seoDescription: z.string().trim().max(320),
  ogMediaId: z.string().nullable(),
  noindex: z.boolean(),
  // The defaults keep drafts and revisions saved before these existed readable.
  /** A full URL, or empty for the post's own. */
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((url) => url === '' || /^https?:\/\/[^\s/]+\.[^\s]+$/.test(url), {
      message: 'The canonical URL must be a full address starting with https://.',
    })
    .default(''),
  socialTitle: z.string().trim().max(120).default(''),
  socialDescription: z.string().trim().max(320).default(''),
  nofollow: z.boolean().default(false),
  nosnippet: z.boolean().default(false),
  noimageindex: z.boolean().default(false),
  // For the CMS content score only; the website never renders them. The
  // defaults keep drafts and revisions saved before these existed readable.
  focusKeyword: z.string().trim().max(FOCUS_KEYWORD_LIMIT).default(''),
  relatedTerms: z
    .array(z.string().trim().min(1).max(RELATED_TERM_LIMIT))
    .max(RELATED_TERMS_MAX)
    .transform(uniqueTerms)
    .default([]),
});

export type PostInput = z.infer<typeof postInputSchema>;

export const emptyPostInput: PostInput = {
  title: '',
  slug: '',
  excerpt: '',
  body: null,
  authorId: null,
  locationId: null,
  categoryIds: [],
  tags: [],
  featuredMediaId: null,
  seoTitle: '',
  seoDescription: '',
  ogMediaId: null,
  noindex: false,
  canonicalUrl: '',
  socialTitle: '',
  socialDescription: '',
  nofollow: false,
  nosnippet: false,
  noimageindex: false,
  focusKeyword: '',
  relatedTerms: [],
};

/**
 * The search and sharing fields, which people with SEO access may change on a
 * post they cannot otherwise edit (savePostSeo).
 */
export const POST_SEO_KEYS = [
  'seoTitle',
  'seoDescription',
  'ogMediaId',
  'noindex',
  'canonicalUrl',
  'socialTitle',
  'socialDescription',
  'nofollow',
  'nosnippet',
  'noimageindex',
  'focusKeyword',
  'relatedTerms',
] as const satisfies readonly (keyof PostInput)[];

export type PostSeoInput = Pick<PostInput, (typeof POST_SEO_KEYS)[number]>;

export function pickPostSeo(input: PostInput): PostSeoInput {
  return Object.fromEntries(POST_SEO_KEYS.map((key) => [key, input[key]])) as PostSeoInput;
}

/** Extra rules that only apply when a post goes live. */
export function publishErrors(input: Pick<PostInput, 'title' | 'slug'>): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Add a title before publishing.');
  if (!input.slug.trim()) errors.push('Add a permalink before publishing.');
  return errors;
}

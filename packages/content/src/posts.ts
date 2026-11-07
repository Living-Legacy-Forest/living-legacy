import { z } from 'zod';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;

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
  categoryIds: z.array(z.string()).max(20),
  /** Tag names; unknown tags are created on save. */
  tags: z.array(z.string().trim().min(1).max(50)).max(30),
  featuredMediaId: z.string().nullable(),
  seoTitle: z.string().trim().max(120),
  seoDescription: z.string().trim().max(320),
  ogMediaId: z.string().nullable(),
  noindex: z.boolean(),
});

export type PostInput = z.infer<typeof postInputSchema>;

export const emptyPostInput: PostInput = {
  title: '',
  slug: '',
  excerpt: '',
  body: null,
  authorId: null,
  categoryIds: [],
  tags: [],
  featuredMediaId: null,
  seoTitle: '',
  seoDescription: '',
  ogMediaId: null,
  noindex: false,
};

/** Extra rules that only apply when a post goes live. */
export function publishErrors(input: Pick<PostInput, 'title' | 'slug'>): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Add a title before publishing.');
  if (!input.slug.trim()) errors.push('Add a permalink before publishing.');
  return errors;
}

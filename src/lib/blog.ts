// Helpers shared by the blog index, the article page and the migration
// scripts. Everything here works on Portable Text blocks (or plain strings)
// without a Sanity round trip, so reading time and the table of contents come
// out of the body already fetched rather than costing a second query.

const WORDS_PER_MINUTE = 200;

interface PortableTextSpan {
  text?: string;
}

interface PortableTextBlockLike {
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
}

function isBlock(value: unknown): value is PortableTextBlockLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PortableTextBlockLike)._type === 'block'
  );
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Rounds up, and never returns 0: "0 min read" reads as an error. */
export function getReadingTime(blocks: unknown[] | undefined): number {
  if (!blocks || blocks.length === 0) return 1;
  const text = blocks
    .filter(isBlock)
    .flatMap((b) => b.children ?? [])
    .map((c) => c.text ?? '')
    .join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export interface BlogHeading {
  id: string;
  text: string;
}

/**
 * The table of contents. Ids are generated the same way here and in
 * PortableText's h2 renderer, so the anchors line up; if one changes the
 * other has to change with it.
 */
export function extractH2Headings(blocks: unknown[] | undefined): BlogHeading[] {
  if (!blocks) return [];
  return blocks
    .filter(isBlock)
    .filter((b) => b.style === 'h2')
    .map((b) => {
      const text = (b.children ?? []).map((c) => c.text ?? '').join('');
      return { id: slugify(text), text };
    })
    .filter((h) => h.text.length > 0);
}

/** en-AU, not "August 5, 2026": "5 August 2026". */
export function formatBlogDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

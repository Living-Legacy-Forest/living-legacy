// Site-wide search and replace: finding a phrase in plain text and rich text,
// replacing it, and the snippets the preview shows. Rich text is changed inside
// its text only, so formatting, links and images are left alone. A phrase split
// by formatting part-way through (half of it bold) is not found.
import { z } from 'zod';

export const searchReplaceSchema = z.object({
  find: z.string().min(1, 'Enter the text to find.').max(200),
  replace: z.string().max(500),
  matchCase: z.boolean(),
  wholeWords: z.boolean(),
});
export type SearchReplaceInput = z.infer<typeof searchReplaceSchema>;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A fresh pattern for the search; global, so it finds every match. */
export function searchPattern({ find, matchCase, wholeWords }: SearchReplaceInput): RegExp {
  // "Whole words" means no letter, digit or underscore either side, in any language.
  const body = wholeWords ? `(?<![\\p{L}\\p{N}_])${escape(find)}(?![\\p{L}\\p{N}_])` : escape(find);
  return new RegExp(body, matchCase ? 'gu' : 'giu');
}

export function countIn(text: string | null | undefined, pattern: RegExp): number {
  if (!text) return 0;
  return text.match(new RegExp(pattern.source, pattern.flags))?.length ?? 0;
}

/** The text with every match replaced. The replacement is taken literally ($ has no meaning). */
export function replaceIn(text: string, pattern: RegExp, replacement: string): string {
  return text.replace(new RegExp(pattern.source, pattern.flags), () => replacement);
}

type RichNode = { type?: string; text?: string; content?: RichNode[]; [key: string]: unknown };

/** Every text node's text, in order, for counting and snippets. */
export function richTextTexts(doc: unknown): string[] {
  const out: string[] = [];
  const walk = (node: RichNode | null | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.text === 'string') out.push(node.text);
    node.content?.forEach(walk);
  };
  walk(doc as RichNode);
  return out;
}

export function countInRichText(doc: unknown, pattern: RegExp): number {
  return richTextTexts(doc).reduce((sum, text) => sum + countIn(text, pattern), 0);
}

/** A copy of the document with matches replaced in its text; the original is not changed. */
export function replaceInRichText<T>(doc: T, pattern: RegExp, replacement: string): T {
  const walk = (node: RichNode): RichNode => {
    const next: RichNode = { ...node };
    if (typeof node.text === 'string') next.text = replaceIn(node.text, pattern, replacement);
    if (node.content) next.content = node.content.map(walk);
    return next;
  };
  return doc && typeof doc === 'object' ? (walk(doc as RichNode) as T) : doc;
}

export type Snippet = { before: string; match: string; after: string };

/** Up to `limit` matches with a little text either side, for the preview. */
export function snippetsIn(texts: string[], pattern: RegExp, limit = 3, around = 40): Snippet[] {
  const out: Snippet[] = [];
  for (const text of texts) {
    for (const m of text.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      const from = Math.max(0, start - around);
      const to = Math.min(text.length, end + around);
      out.push({
        before: (from > 0 ? '…' : '') + text.slice(from, start),
        match: m[0],
        after: text.slice(end, to) + (to < text.length ? '…' : ''),
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

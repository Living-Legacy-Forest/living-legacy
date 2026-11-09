// What the content score needs from a stored rich text document (Tiptap
// JSON), read in one walk. Unknown or malformed nodes are skipped, never
// thrown on, so the panel always has something to show.
import type { RichTextDoc } from './posts';

export interface OutlineHeading {
  level: number;
  text: string;
}

export interface OutlineLink {
  href: string;
  text: string;
  internal: boolean;
}

export interface RichTextOutline {
  /** All the text, headings, lists and tables included. */
  text: string;
  words: string[];
  /** Paragraphs outside lists and tables, trimmed, empty ones dropped. */
  paragraphs: string[];
  /** Sentences from every paragraph outside tables, lists included. */
  sentences: string[];
  headings: OutlineHeading[];
  /** Alt text of each image, '' when missing. */
  imageAlts: string[];
  /** Links to pages. Anchors, mailto: and tel: are left out. */
  links: OutlineLink[];
}

type Node = { type?: unknown; content?: unknown; marks?: unknown; attrs?: unknown; text?: unknown };

const SITE_HOSTS = new Set(['livinglegacy.com.au', 'www.livinglegacy.com.au']);
const WORD_CHAR = /[\p{L}\p{N}]/u;

const childrenOf = (node: Node): unknown[] => (Array.isArray(node.content) ? node.content : []);
const attrOf = (node: Node, key: string): unknown =>
  node.attrs && typeof node.attrs === 'object'
    ? (node.attrs as Record<string, unknown>)[key]
    : undefined;
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** 'internal' for a site path or this site's host, 'external' for another site, null for anything else. */
export function linkKind(href: string): 'internal' | 'external' | null {
  const value = href.trim();
  if (/^\/(?!\/)/.test(value)) return 'internal';
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return SITE_HOSTS.has(new URL(value).hostname.toLowerCase()) ? 'internal' : 'external';
  } catch {
    return null;
  }
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => WORD_CHAR.test(word));
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => WORD_CHAR.test(sentence));
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches `phrase` as whole words, in any case, with any run of spaces between words. */
export function phraseRegex(phrase: string): RegExp {
  const body = phrase.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

export function countPhrase(text: string, phrase: string): number {
  if (!phrase.trim()) return 0;
  return text.match(phraseRegex(phrase))?.length ?? 0;
}

function linkHref(node: Node): string | null {
  if (!Array.isArray(node.marks)) return null;
  for (const mark of node.marks as { type?: unknown; attrs?: { href?: unknown } }[]) {
    if (mark?.type === 'link' && typeof mark.attrs?.href === 'string') return mark.attrs.href;
  }
  return null;
}

function altOf(node: Node): string {
  const alt = attrOf(node, 'alt');
  return typeof alt === 'string' ? alt.trim() : '';
}

// Like richTextPlainText, but safe on malformed nodes (a non-array `content`
// would make that one throw), and a hard break separates words.
function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Node;
  if (n.type === 'text') return typeof n.text === 'string' ? n.text : '';
  const inner = childrenOf(n).map(plainText).join('');
  return n.type === 'paragraph' || n.type === 'heading' || n.type === 'hardBreak'
    ? `${inner} `
    : inner;
}

export function outlineRichText(doc: RichTextDoc | null | undefined): RichTextOutline {
  const paragraphs: string[] = [];
  const prose: string[] = [];
  const headings: OutlineHeading[] = [];
  const imageAlts: string[] = [];
  const links: OutlineLink[] = [];

  /** Text of an inline run. Records its links; neighbouring pieces of one link join. */
  function inline(node: Node): string {
    let text = '';
    let open: OutlineLink | null = null;
    for (const child of childrenOf(node)) {
      if (!child || typeof child !== 'object') continue;
      const c = child as Node;
      if (c.type === 'text' && typeof c.text === 'string') {
        text += c.text;
        const href = linkHref(c);
        if (href !== null && open && open.href === href) {
          open.text += c.text;
          continue;
        }
        const kind = href === null ? null : linkKind(href);
        open = kind && href ? { href, text: c.text, internal: kind === 'internal' } : null;
        if (open) links.push(open);
        continue;
      }
      open = null;
      if (c.type === 'hardBreak') text += ' ';
      else if (c.type === 'image') imageAlts.push(altOf(c));
      else text += inline(c);
    }
    return text;
  }

  function walk(node: unknown, inList: boolean, inTable: boolean): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Node;
    if (n.type === 'paragraph') {
      const text = squash(inline(n));
      if (!text) return;
      if (!inTable) prose.push(text);
      if (!inList && !inTable) paragraphs.push(text);
      return;
    }
    if (n.type === 'heading') {
      const level = Number(attrOf(n, 'level'));
      headings.push({
        level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2,
        text: squash(inline(n)),
      });
      return;
    }
    if (n.type === 'image') {
      imageAlts.push(altOf(n));
      return;
    }
    const list =
      inList || n.type === 'bulletList' || n.type === 'orderedList' || n.type === 'taskList';
    const table = inTable || n.type === 'table';
    for (const child of childrenOf(n)) walk(child, list, table);
  }

  walk(doc, false, false);
  for (const link of links) link.text = squash(link.text);
  const text = squash(plainText(doc));
  return {
    text,
    words: splitWords(text),
    paragraphs,
    sentences: prose.flatMap(splitSentences),
    headings,
    imageAlts,
    links,
  };
}

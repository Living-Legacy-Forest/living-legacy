// Markdown to the CMS's rich text (Tiptap JSON), for the API: tools that write
// posts (scripts, automations, AI writers) produce Markdown, not editor JSON.
// Deliberately small: it covers what the editor itself can show and nothing
// more, so the result always passes isAllowedRichText.
//
// Blocks: ## to #### headings (a single # becomes ##, since the post title is
// the page's h1), paragraphs, - / * / 1. lists, > quotes, ``` code and ---.
// Inline: **bold**, *italic* or _italic_, `code` and [links](https://…).
import type { RichTextDoc } from './posts';

type Mark = { type: string; attrs?: Record<string, string> };
type Node = {
  type: string;
  attrs?: Record<string, string | number | boolean | null>;
  content?: Node[];
  marks?: Mark[];
  text?: string;
};

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

// One inline token at a time; the inner text of bold, italic and links is
// parsed again so marks can nest ("**a [link](…)**").
const INLINE =
  /\*\*(.+?)\*\*|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/;

function inline(text: string, marks: Mark[] = []): Node[] {
  const nodes: Node[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      nodes.push(textNode(rest, marks));
      break;
    }
    if (m.index > 0) nodes.push(textNode(rest.slice(0, m.index), marks));
    const [whole, bold, star, under, code, label, href] = m;
    if (bold !== undefined) nodes.push(...inline(bold, [...marks, { type: 'bold' }]));
    else if (star !== undefined) nodes.push(...inline(star, [...marks, { type: 'italic' }]));
    else if (under !== undefined) nodes.push(...inline(under, [...marks, { type: 'italic' }]));
    else if (code !== undefined) nodes.push(textNode(code, [...marks, { type: 'code' }]));
    else if (label !== undefined && href !== undefined) {
      nodes.push(
        ...(SAFE_LINK.test(href)
          ? inline(label, [...marks, { type: 'link', attrs: { href } }])
          : inline(label, marks))
      );
    }
    rest = rest.slice(m.index + whole.length);
  }
  return nodes.filter((n) => n.text);
}

function textNode(text: string, marks: Mark[]): Node {
  return marks.length ? { type: 'text', text, marks } : { type: 'text', text };
}

const paragraph = (text: string): Node => {
  const content = inline(text.trim());
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

export function markdownToRichText(markdown: string): RichTextDoc {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const content: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code: everything up to the closing fence, as written.
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? '')) code.push(lines[i++] ?? '');
      i++;
      const text = code.join('\n');
      content.push(
        text ? { type: 'codeBlock', content: [{ type: 'text', text }] } : { type: 'codeBlock' }
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = Math.min(Math.max(heading[1]!.length, 2), 4);
      const text = inline(heading[2] ?? '');
      content.push({
        type: 'heading',
        attrs: { level },
        ...(text.length ? { content: text } : {}),
      });
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      content.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i] ?? '')) {
        quoted.push((lines[i++] ?? '').replace(/^\s*>\s?/, ''));
      }
      const inner = (markdownToRichText(quoted.join('\n')).content ?? []) as Node[];
      content.push({ type: 'blockquote', content: inner.length ? inner : [paragraph('')] });
      continue;
    }

    const first = LIST_ITEM.exec(line);
    if (first) {
      const ordered = first[2] !== undefined;
      const items: Node[] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i] ?? '');
        if (!m || (m[2] !== undefined) !== ordered) break;
        items.push({ type: 'listItem', content: [paragraph(m[3] ?? '')] });
        i++;
      }
      const start = ordered ? Number(first[2]) : 1;
      content.push({
        type: ordered ? 'orderedList' : 'bulletList',
        ...(ordered && start > 1 ? { attrs: { start } } : {}),
        content: items,
      });
      continue;
    }

    // A paragraph runs until a blank line or the start of another block.
    const text: string[] = [];
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (
        !next.trim() ||
        /^\s*(```|#{1,6}\s|>)/.test(next) ||
        LIST_ITEM.test(next) ||
        /^\s*([-*_])(\s*\1){2,}\s*$/.test(next)
      ) {
        break;
      }
      text.push(next.trim());
      i++;
    }
    content.push(paragraph(text.join(' ')));
  }

  return { type: 'doc', content } as RichTextDoc;
}

// ---------------------------------------------------------------------------
// And back again, for AI tools that read a post before editing it. It writes
// only what markdownToRichText reads, so a post that round-trips comes back
// the same. Anything else (images, tables, underline, line breaks…) is named
// in `editorOnly`: sending the Markdown back would lose it.

const plainText = (node: Node): string =>
  node.text ?? (node.content ?? []).map(plainText).join(' ');

export function richTextToMarkdown(doc: RichTextDoc | null): {
  markdown: string;
  editorOnly: string[];
} {
  const editorOnly = new Set<string>();

  const inlineText = (nodes: Node[] = []): string =>
    nodes
      .map((node) => {
        if (node.type !== 'text') {
          editorOnly.add(node.type);
          return node.type === 'hardBreak' ? ' ' : plainText(node);
        }
        // The first mark is the outermost, as markdownToRichText nests them.
        let text = node.text ?? '';
        for (const mark of [...(node.marks ?? [])].reverse()) {
          if (mark.type === 'code') text = `\`${text}\``;
          else if (mark.type === 'italic') text = `*${text}*`;
          else if (mark.type === 'bold') text = `**${text}**`;
          else if (mark.type === 'link' && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
          else editorOnly.add(mark.type);
        }
        return text;
      })
      .join('')
      // Two bold runs side by side read as one: "**a ****b**" is "**a b**".
      .replace(/(?<!\*)\*{4}(?!\*)/g, '');

  const block = (node: Node): string => {
    switch (node.type) {
      case 'paragraph':
        return inlineText(node.content);
      case 'heading':
        return `${'#'.repeat(Number(node.attrs?.level) || 2)} ${inlineText(node.content)}`;
      case 'bulletList':
      case 'orderedList': {
        const start = Number(node.attrs?.start) || 1;
        return (node.content ?? [])
          .map((item, i) => {
            const [first, ...more] = item.content ?? [];
            if (more.length || (first && first.type !== 'paragraph')) editorOnly.add('nested list');
            const text = (item.content ?? []).map(block).join(' ');
            return `${node.type === 'orderedList' ? `${start + i}.` : '-'} ${text}`;
          })
          .join('\n');
      }
      case 'blockquote':
        return blocks(node.content)
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n');
      case 'codeBlock':
        return `\`\`\`\n${(node.content ?? []).map((n) => n.text ?? '').join('')}\n\`\`\``;
      case 'horizontalRule':
        return '---';
      default:
        // Kept as plain text, so whatever reads it still sees the words.
        editorOnly.add(node.type);
        return plainText(node);
    }
  };

  const blocks = (nodes: Node[] = []) =>
    nodes
      .map(block)
      .filter((text) => text.trim())
      .join('\n\n');

  const markdown = blocks((doc?.content ?? []) as Node[]);
  return { markdown, editorOnly: [...editorOnly].sort() };
}

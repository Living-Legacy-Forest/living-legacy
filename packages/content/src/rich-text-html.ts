// Turns a stored rich text document (Tiptap JSON) into HTML for the website.
// Only the nodes and marks isAllowedRichText accepts are handled; anything
// else renders its children (or nothing), so an unexpected node can never
// inject markup. Text and attributes are always escaped.
import { type JsonValue, type RichTextDoc, slugify } from './posts';

type Node = {
  type: string;
  content?: Node[];
  marks?: { type: string; attrs?: Record<string, JsonValue> }[];
  attrs?: Record<string, JsonValue>;
  text?: string;
};

export interface RichTextHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderedRichText {
  html: string;
  /** H2 and H3 headings, with the ids their tags carry, for a table of contents. */
  headings: RichTextHeading[];
  /** Plain text, for reading time and search. */
  text: string;
}

export interface RenderRichTextOptions {
  /** Prefixed to site paths in image sources (e.g. "/api/media/…"), so they load from the CMS. */
  mediaOrigin?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isSafeHref = (href: string) => /^(https?:|mailto:|tel:|\/|#)/i.test(href.trim());

/** Every text node under `node`, joined. */
export function richTextPlainText(node: unknown): string {
  const n = node as Node | null;
  if (!n) return '';
  if (n.type === 'text') return n.text ?? '';
  const parts = (n.content ?? []).map(richTextPlainText);
  // Block-level nodes are separated by a space so words do not run together.
  return n.type === 'paragraph' || n.type === 'heading' ? parts.join('') + ' ' : parts.join('');
}

export function renderRichText(
  doc: RichTextDoc | null | undefined,
  options: RenderRichTextOptions = {}
): RenderedRichText {
  const headings: RichTextHeading[] = [];
  const usedIds = new Map<string, number>();

  const headingId = (text: string) => {
    const base = slugify(text) || 'section';
    const seen = usedIds.get(base) ?? 0;
    usedIds.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  const imageSrc = (src: string) =>
    options.mediaOrigin && /^\/(?!\/)/.test(src) ? `${options.mediaOrigin}${src}` : src;

  // CMS uploads have 640px and 1280px copies (the CMS serves the original when
  // an older upload has none), and the article column is under 720px wide.
  const sizedImage = (src: string) => {
    if (!options.mediaOrigin || !/^\/api\/media\/[\w-]+$/.test(src)) {
      return `src="${escapeHtml(imageSrc(src))}"`;
    }
    const url = escapeHtml(imageSrc(src));
    return `src="${url}?w=1280" srcset="${url}?w=640 640w, ${url}?w=1280 1280w" sizes="(min-width: 768px) 720px, 100vw"`;
  };

  const renderText = (node: Node) => {
    let html = escapeHtml(node.text ?? '');
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          html = `<strong>${html}</strong>`;
          break;
        case 'italic':
          html = `<em>${html}</em>`;
          break;
        case 'underline':
          html = `<u>${html}</u>`;
          break;
        case 'strike':
          html = `<del>${html}</del>`;
          break;
        case 'code':
          html = `<code>${html}</code>`;
          break;
        case 'highlight':
          html = `<mark>${html}</mark>`;
          break;
        case 'subscript':
          html = `<sub>${html}</sub>`;
          break;
        case 'superscript':
          html = `<sup>${html}</sup>`;
          break;
        case 'link': {
          const href = String(mark.attrs?.href ?? '');
          if (!isSafeHref(href)) break;
          // External links open in a new tab; rel="noopener" stops the opened
          // page reaching back to this one through window.opener.
          const external = /^https?:/i.test(href);
          const rel = external ? ' target="_blank" rel="noopener noreferrer"' : '';
          html = `<a href="${escapeHtml(href)}"${rel}>${html}</a>`;
          break;
        }
      }
    }
    return html;
  };

  const render = (node: Node): string => {
    const inner = () => (node.content ?? []).map(render).join('');
    switch (node.type) {
      case 'doc':
        return inner();
      case 'text':
        return renderText(node);
      case 'paragraph':
        return `<p>${inner()}</p>`;
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4);
        const text = richTextPlainText(node).trim();
        if (level === 4) return `<h4>${inner()}</h4>`;
        const id = headingId(text);
        if (text) headings.push({ id, text, level: level as 2 | 3 });
        return `<h${level} id="${id}">${inner()}</h${level}>`;
      }
      case 'bulletList':
        return `<ul>${inner()}</ul>`;
      case 'orderedList': {
        const start = Number(node.attrs?.start);
        return `<ol${start > 1 ? ` start="${start}"` : ''}>${inner()}</ol>`;
      }
      case 'listItem':
        return `<li>${inner()}</li>`;
      case 'taskList':
        return `<ul class="task-list">${inner()}</ul>`;
      case 'taskItem':
        return `<li data-checked="${node.attrs?.checked === true}">${inner()}</li>`;
      case 'blockquote':
        return `<blockquote>${inner()}</blockquote>`;
      case 'codeBlock':
        return `<pre><code>${inner()}</code></pre>`;
      case 'horizontalRule':
        return '<hr />';
      case 'hardBreak':
        return '<br />';
      case 'table':
        return `<div class="table-wrap"><table><tbody>${inner()}</tbody></table></div>`;
      case 'tableRow':
        return `<tr>${inner()}</tr>`;
      case 'tableHeader':
      case 'tableCell': {
        const tag = node.type === 'tableHeader' ? 'th' : 'td';
        const colspan = Number(node.attrs?.colspan);
        const rowspan = Number(node.attrs?.rowspan);
        const span =
          (colspan > 1 ? ` colspan="${colspan}"` : '') +
          (rowspan > 1 ? ` rowspan="${rowspan}"` : '');
        return `<${tag}${span}>${inner()}</${tag}>`;
      }
      case 'image': {
        const src = String(node.attrs?.src ?? '');
        if (!src) return '';
        const alt = escapeHtml(String(node.attrs?.alt ?? ''));
        const caption = String(node.attrs?.title ?? '');
        return `<figure><img ${sizedImage(src)} alt="${alt}" loading="lazy" decoding="async" />${
          caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''
        }</figure>`;
      }
      default:
        return inner();
    }
  };

  const html = doc ? render(doc as Node) : '';
  return { html, headings, text: richTextPlainText(doc).replace(/\s+/g, ' ').trim() };
}

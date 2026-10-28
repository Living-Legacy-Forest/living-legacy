/**
 * Turning WordPress post HTML into Portable Text.
 *
 * Split out from the migration script so the awkward parts, which are all in
 * here, can be tested without a network or a write token.
 *
 * The corpus is not uniform. The newer posts are clean Gutenberg blocks
 * (`wp-block-paragraph`, `wp-block-heading`, `wp-block-image`). The older
 * ones are Elementor, which wraps everything in nested `div` and `span` and
 * carries its own furniture, including an Elementor data table widget on one
 * post. Both have to come out the other side as the same Portable Text.
 */

/**
 * Markup that is furniture rather than writing, removed before conversion.
 */
const STRIP_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'svg',
  'iframe',
  'link',
  'meta',
];

/**
 * Remove an embedded HTML document wholesale.
 *
 * A nested `<html>` inside post content is never editorial. Taking the whole
 * span out is safer than stripping its parts, because the parts on their own
 * (a stray `<body>`, a loose `<title>`) would be lifted into the article by
 * any parser tolerant enough to read the rest of this markup. None of this
 * site's 21 real posts carry one, but a future post might.
 */
export function stripEmbeddedDocuments(html: string): string {
  return html.replace(/<html[\s\S]*?<\/html>/gi, '');
}

/**
 * Drop elements whose content is not writing, tag and contents together.
 *
 * Written against the string rather than the DOM because it runs before
 * parsing: a `<style>` block full of CSS braces and a `<script>` full of
 * jQuery are exactly the payloads that make a tolerant parser produce
 * surprising trees, so they are gone before the parser sees them.
 */
export function stripNonContentElements(html: string): string {
  let out = stripEmbeddedDocuments(html);
  for (const tag of STRIP_ELEMENTS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
    // Void and unclosed forms of the same tags.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '');
  }
  return out;
}

/**
 * Deal with an `h1` Elementor renders inside the post body.
 *
 * The article page already prints the title as the page's own `h1` in
 * BlogHero, so a body `h1` that repeats it verbatim would show every reader
 * the headline twice and put two `h1` elements on the page: a heading-order
 * problem for a screen reader and a duplicate-heading signal for a crawler.
 *
 * A title duplicate is dropped. Anything else is demoted to `h2`, because it
 * is a real section heading and the schema has no `h1` style to hold it: left
 * alone it would deserialize into an ordinary paragraph and the article would
 * lose the structure its table of contents is built from.
 *
 * Matching ignores case, punctuation and whitespace.
 */
export function normaliseBodyHeadings(html: string, title: string): string {
  const flatten = (text: string): string =>
    decodeEntities(text.replace(/<[^>]*>/g, ''))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const wanted = flatten(title);

  return html.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_match, inner: string) => {
    const text = flatten(inner);
    if (text.length === 0 || text === wanted) return '';
    return `<h2>${inner}</h2>`;
  });
}

/**
 * WordPress writes its own absolute URLs into body links.
 *
 * Left alone, every internal link in a migrated post would point back at the
 * WordPress site this build replaces, so the new site would quietly drive its
 * readers to the old one. Only these hosts are rewritten; genuine outbound
 * links are left exactly as they are.
 */
export function toRelativeInternalLinks(href: string, wpHosts: string[]): string {
  try {
    const url = new URL(href);
    if (!wpHosts.includes(url.hostname.replace(/^www\./, ''))) return href;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Already relative, or not a URL at all. Either way, not ours to touch.
    return href;
  }
}

/**
 * The largest rendition WordPress offers for an image.
 *
 * Body images arrive with a `srcset` of generated sizes and a `src` that is
 * usually a middle one, so `src` alone would upload a 1024px copy of a
 * 2362px original and there would be no way back to the full resolution
 * afterwards. The widest candidate in the srcset is the closest thing to the
 * original the REST API exposes.
 */
export function widestFromSrcset(srcset: string | null, fallback: string): string {
  if (!srcset) return fallback;
  const candidates = srcset
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/);
      const width = descriptor?.endsWith('w') ? Number.parseInt(descriptor, 10) : 0;
      return { url, width: Number.isFinite(width) ? width : 0 };
    })
    .filter((c) => Boolean(c.url));

  if (candidates.length === 0) return fallback;
  return candidates.reduce((best, c) => (c.width > best.width ? c : best)).url ?? fallback;
}

/** WordPress renders entities; Portable Text stores plain text. */
export function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#8217;': '’',
    '&#8216;': '‘',
    '&#8220;': '“',
    '&#8221;': '”',
    '&#8211;': '–',
    '&#8212;': '—',
    '&nbsp;': ' ',
    '&hellip;': '…',
  };
  return text.replace(/&[a-z]+;|&#\d+;/gi, (m) => named[m.toLowerCase()] ?? m).replace(/ /g, ' ');
}

/**
 * Collect every image the body will need, so they can be uploaded in one pass
 * before conversion runs.
 *
 * Conversion has to emit an asset reference, which means the upload must
 * already have happened by the time a rule fires. Hence two passes: gather
 * here, upload, then convert with a URL to asset id map in hand.
 */
export function collectImageUrls(html: string): string[] {
  const cleaned = stripNonContentElements(html);
  const urls: string[] = [];
  for (const match of cleaned.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    const srcset = tag.match(/\ssrcset=["']([^"']+)["']/i)?.[1] ?? null;
    if (!src) continue;
    urls.push(widestFromSrcset(srcset, src));
  }
  return [...new Set(urls)];
}

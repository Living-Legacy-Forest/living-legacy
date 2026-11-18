import { describe, expect, it } from 'vitest';
import type { RichTextDoc } from './posts';
import { renderRichText } from './rich-text-html';

const doc = (...content: unknown[]) => ({ type: 'doc', content }) as RichTextDoc;
const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, marks });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const h = (level: number, value: string) => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

describe('renderRichText', () => {
  it('escapes text', () => {
    expect(renderRichText(doc(p(text('<b>&</b>')))).html).toBe('<p>&lt;b&gt;&amp;&lt;/b&gt;</p>');
  });

  it('gives headings unique ids and lists them', () => {
    const { html, headings } = renderRichText(doc(h(2, 'Why trees'), h(3, 'Why trees')));
    expect(html).toBe('<h2 id="why-trees">Why trees</h2><h3 id="why-trees-2">Why trees</h3>');
    expect(headings).toEqual([
      { id: 'why-trees', text: 'Why trees', level: 2 },
      { id: 'why-trees-2', text: 'Why trees', level: 3 },
    ]);
  });

  it('opens external links in a new tab and drops unsafe ones', () => {
    const safe = text('site', [{ type: 'link', attrs: { href: 'https://example.com' } }]);
    const local = text('faq', [{ type: 'link', attrs: { href: '/faqs/' } }]);
    const unsafe = text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]);
    expect(renderRichText(doc(p(safe, local, unsafe))).html).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>' +
        '<a href="/faqs/">faq</a>x</p>'
    );
  });

  it('loads site-path images from the media origin', () => {
    const image = { type: 'image', attrs: { src: '/uploads/old.jpg', alt: 'A tree' } };
    expect(renderRichText(doc(image), { mediaOrigin: 'https://cms.test' }).html).toContain(
      'src="https://cms.test/uploads/old.jpg" alt="A tree"'
    );
  });

  it('serves media library images at the sizes the CMS keeps', () => {
    const image = { type: 'image', attrs: { src: '/api/media/abc', alt: 'A tree' } };
    expect(renderRichText(doc(image), { mediaOrigin: 'https://cms.test' }).html).toContain(
      'src="https://cms.test/api/media/abc?w=1280" ' +
        'srcset="https://cms.test/api/media/abc?w=640 640w, https://cms.test/api/media/abc?w=1280 1280w" ' +
        'sizes="(min-width: 768px) 720px, 100vw" alt="A tree"'
    );
  });

  it('leaves media paths alone without a media origin', () => {
    const image = { type: 'image', attrs: { src: '/api/media/abc', alt: '' } };
    expect(renderRichText(doc(image)).html).toContain('<img src="/api/media/abc" alt=""');
  });

  it('skips unknown nodes but keeps their text', () => {
    expect(renderRichText(doc({ type: 'mystery', content: [p(text('kept'))] })).html).toBe(
      '<p>kept</p>'
    );
  });

  it('returns plain text with words kept apart', () => {
    expect(renderRichText(doc(h(2, 'Title'), p(text('One')), p(text('two')))).text).toBe(
      'Title One two'
    );
  });
  it('renders a video embed as a player built from its id, never from stored markup', () => {
    const { html } = renderRichText(
      doc({
        type: 'videoEmbed',
        attrs: { provider: 'youtube', id: 'dQw4w9WgXcQ', title: 'Open day <b>' },
      })
    );
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('<figcaption>Open day &lt;b&gt;</figcaption>');
    expect(html).toContain('loading="lazy"');
  });

  it('drops a video embed with an id that is not a real one', () => {
    const { html } = renderRichText(
      doc({ type: 'videoEmbed', attrs: { provider: 'youtube', id: '"><script>' } })
    );
    expect(html).toBe('');
  });
});

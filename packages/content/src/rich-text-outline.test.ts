import { describe, expect, it } from 'vitest';
import type { RichTextDoc } from './posts';
import {
  countPhrase,
  linkKind,
  outlineRichText,
  phraseRegex,
  splitSentences,
} from './rich-text-outline';

const t = (text: string, href?: string) => ({
  type: 'text',
  text,
  ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}),
});
const p = (...content: object[]) => ({ type: 'paragraph', content });
const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [t(text)],
});
const img = (alt?: string) => ({
  type: 'image',
  attrs: { src: '/media/a.jpg', ...(alt === undefined ? {} : { alt }) },
});
const list = (...items: string[]) => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [p(t(item))] })),
});
const table = (text: string) => ({
  type: 'table',
  content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p(t(text))] }] }],
});
const doc = (...content: object[]) => ({ type: 'doc', content }) as RichTextDoc;

describe('outlineRichText', () => {
  it('reads paragraphs, headings, words and sentences', () => {
    const o = outlineRichText(
      doc(
        h(2, 'Why trees'),
        p(t('Trees grow. They live long.')),
        p(t('  ')),
        list('A list item here.')
      )
    );
    expect(o.headings).toEqual([{ level: 2, text: 'Why trees' }]);
    expect(o.paragraphs).toEqual(['Trees grow. They live long.']);
    expect(o.sentences).toEqual(['Trees grow.', 'They live long.', 'A list item here.']);
    expect(o.words).toHaveLength(11);
  });

  it('counts table words but keeps table text out of paragraphs and sentences', () => {
    const o = outlineRichText(doc(table('Price per tree.')));
    expect(o.words).toHaveLength(3);
    expect(o.paragraphs).toEqual([]);
    expect(o.sentences).toEqual([]);
  });

  it('records image alt text, empty when missing or blank, inline images included', () => {
    const o = outlineRichText(doc(img('A young gum'), img(), p(t('See this '), img('  '))));
    expect(o.imageAlts).toEqual(['A young gum', '', '']);
  });

  it('classes links and joins the pieces of one link', () => {
    const o = outlineRichText(
      doc(
        p(
          t('Read '),
          t('our ', '/about'),
          {
            type: 'text',
            text: 'story',
            marks: [{ type: 'bold' }, { type: 'link', attrs: { href: '/about' } }],
          },
          t(' or '),
          t('the news', 'https://example.com/a'),
          t(' and '),
          t('top', '#top'),
          t(' or '),
          t('email', 'mailto:hi@example.com')
        )
      )
    );
    expect(o.links).toEqual([
      { href: '/about', text: 'our story', internal: true },
      { href: 'https://example.com/a', text: 'the news', internal: false },
    ]);
  });

  it('treats a missing or malformed document as empty instead of throwing', () => {
    expect(outlineRichText(null).words).toEqual([]);
    const odd = { type: 'doc', content: 'nope' } as unknown as RichTextDoc;
    expect(outlineRichText(odd).paragraphs).toEqual([]);
    const badHeading = doc({ type: 'heading', attrs: { level: 'x' }, content: [t('Hi')] });
    expect(outlineRichText(badHeading).headings).toEqual([{ level: 2, text: 'Hi' }]);
  });
});

describe('linkKind', () => {
  it('knows site paths and this site, and ignores links that are not pages', () => {
    expect(linkKind('/locations/')).toBe('internal');
    expect(linkKind('https://www.livinglegacy.com.au/faqs/')).toBe('internal');
    expect(linkKind('https://example.com/')).toBe('external');
    expect(linkKind('//example.com/')).toBeNull();
    expect(linkKind('#top')).toBeNull();
    expect(linkKind('tel:0300000000')).toBeNull();
  });
});

describe('splitSentences', () => {
  it('splits after full stops, question marks and exclamation marks', () => {
    expect(splitSentences('Wait. Really? Yes!')).toEqual(['Wait.', 'Really?', 'Yes!']);
  });
});

describe('countPhrase', () => {
  it('matches whole words in any case and any spacing', () => {
    expect(countPhrase('Living trees. living  Trees, livingtrees', 'living trees')).toBe(2);
  });

  it('copes with symbols in the phrase', () => {
    expect(countPhrase('C++ and c++', 'c++')).toBe(2);
    expect(countPhrase('ashes (cremated) here', 'ashes (cremated)')).toBe(1);
    expect(() => phraseRegex('!!!')).not.toThrow();
  });

  it('returns 0 for an empty phrase', () => {
    expect(countPhrase('anything', '  ')).toBe(0);
  });
});

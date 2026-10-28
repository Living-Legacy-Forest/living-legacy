import { describe, expect, it } from 'vitest';
import { isAllowedRichText, postInputSchema, publishErrors, slugify } from './posts';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('What happens at a Tree Planting Ceremony?')).toBe(
      'what-happens-at-a-tree-planting-ceremony'
    );
  });

  it('strips accents, apostrophes and repeated separators', () => {
    expect(slugify("  Mum's  café -- garden  ")).toBe('mums-cafe-garden');
  });

  it('turns ampersands into "and"', () => {
    expect(slugify('Trees & seasons')).toBe('trees-and-seasons');
  });

  it('caps the length without a trailing hyphen', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('isAllowedRichText', () => {
  const doc = (content: unknown[]) => ({ type: 'doc', content });

  it('accepts the blocks and marks the editor produces', () => {
    expect(
      isAllowedRichText(
        doc([
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: '/a' } }] },
            ],
          },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
          { type: 'horizontalRule' },
        ])
      )
    ).toBe(true);
  });

  it('rejects unknown nodes and marks anywhere in the tree', () => {
    expect(isAllowedRichText(doc([{ type: 'iframe' }]))).toBe(false);
    expect(
      isAllowedRichText(
        doc([
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'script' }] }],
          },
        ])
      )
    ).toBe(false);
  });

  it('accepts tables, sub/superscript and hosted images', () => {
    expect(
      isAllowedRichText(
        doc([
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph' }] },
                  { type: 'tableCell', content: [{ type: 'paragraph' }] },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '2', marks: [{ type: 'superscript' }] }],
          },
          { type: 'image', attrs: { src: 'https://cdn.example.com/a.jpg' } },
          { type: 'image', attrs: { src: '/media/2026/10/a.jpg' } },
        ])
      )
    ).toBe(true);
  });

  it('rejects embedded or unsafe image sources', () => {
    expect(
      isAllowedRichText(doc([{ type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } }]))
    ).toBe(false);
    expect(isAllowedRichText(doc([{ type: 'image', attrs: { src: 'javascript:alert(1)' } }]))).toBe(
      false
    );
    expect(isAllowedRichText(doc([{ type: 'image' }]))).toBe(false);
    expect(isAllowedRichText(doc([{ type: 'imagePlaceholder' }]))).toBe(false);
  });

  it('rejects javascript: links', () => {
    expect(
      isAllowedRichText(
        doc([
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [{ type: 'link', attrs: { href: ' JavaScript:alert(1)' } }],
              },
            ],
          },
        ])
      )
    ).toBe(false);
  });

  it('rejects anything that is not a doc', () => {
    expect(isAllowedRichText({ type: 'paragraph' })).toBe(false);
    expect(isAllowedRichText('text')).toBe(false);
  });
});

describe('postInputSchema and publishErrors', () => {
  const base = {
    title: 'A title',
    slug: 'a-title',
    excerpt: '',
    body: null,
    authorId: null,
    categoryIds: [],
    tags: [],
    seoTitle: '',
    seoDescription: '',
    noindex: false,
  };

  it('accepts a minimal post and allows an empty slug for drafts', () => {
    expect(postInputSchema.safeParse(base).success).toBe(true);
    expect(postInputSchema.safeParse({ ...base, slug: '' }).success).toBe(true);
  });

  it('rejects malformed slugs', () => {
    expect(postInputSchema.safeParse({ ...base, slug: 'Not A Slug' }).success).toBe(false);
  });

  it('requires a title and slug to publish', () => {
    expect(publishErrors(base)).toEqual([]);
    expect(publishErrors({ ...base, title: ' ', slug: '' })).toEqual([
      'Add a title before publishing.',
      'Add a permalink before publishing.',
    ]);
  });
});

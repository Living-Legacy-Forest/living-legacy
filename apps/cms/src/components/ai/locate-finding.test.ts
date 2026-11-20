import type { RichTextDoc } from '@ll/content';
import { describe, expect, it } from 'vitest';
import { locateFinding } from './locate-finding';

const doc = (...paragraphs: string[]): RichTextDoc => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

const blank: Parameters<typeof locateFinding>[0] = {
  title: '',
  excerpt: '',
  seoTitle: '',
  seoDescription: '',
  body: null,
};

describe('locateFinding', () => {
  it('finds a word in the summary and returns just its sentence', () => {
    expect(
      locateFinding({ ...blank, excerpt: 'A calm place. Choose a plot today.' }, 'plot')
    ).toEqual({ field: 'excerpt', sentence: 'Choose a plot today.' });
  });

  it('reports the title when the word is in both the title and the body', () => {
    expect(
      locateFinding({ ...blank, title: 'Your plot', body: doc('The plot is shaded.') }, 'plot')
    ).toEqual({ field: 'title', sentence: 'Your plot' });
  });

  it('finds a word that is only in a paragraph of the body', () => {
    expect(
      locateFinding({ ...blank, body: doc('We plant trees.', 'Each plot is mapped.') }, 'plot')
    ).toEqual({ field: 'body', sentence: 'Each plot is mapped.' });
  });

  it('is null when the word is not in any field it can rewrite', () => {
    expect(locateFinding({ ...blank, title: 'A calm place' }, 'plot')).toBeNull();
  });

  it('is null for a word that is only in an image description inside the body', () => {
    const body: RichTextDoc = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a.jpg', alt: 'A plot with flowers' } }],
    };
    expect(locateFinding({ ...blank, body }, 'plot')).toBeNull();
  });
});

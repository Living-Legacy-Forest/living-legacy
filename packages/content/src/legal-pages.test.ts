import { describe, expect, it } from 'vitest';
import { legalPath, legalPublishErrors } from './legal-pages';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});

describe('legalPublishErrors', () => {
  it('accepts a page with a title and text', () => {
    expect(
      legalPublishErrors({
        title: 'Privacy policy',
        body: doc('We keep it safe.'),
        seoDescription: '',
      })
    ).toEqual([]);
  });

  it('refuses a missing title', () => {
    expect(legalPublishErrors({ title: '  ', body: doc('Text'), seoDescription: '' })).toEqual([
      'Add a title before publishing.',
    ]);
  });

  it('refuses a body with no text', () => {
    expect(legalPublishErrors({ title: 'Terms', body: doc(''), seoDescription: '' })).toEqual([
      'Add the page text before publishing.',
    ]);
    expect(legalPublishErrors({ title: 'Terms', body: null, seoDescription: '' })).toEqual([
      'Add the page text before publishing.',
    ]);
  });
});

describe('legalPath', () => {
  it('is the page URL with a trailing slash', () => {
    expect(legalPath('terms-and-conditions')).toBe('/terms-and-conditions/');
  });
});

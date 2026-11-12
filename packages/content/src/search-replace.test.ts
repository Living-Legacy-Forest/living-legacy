import { describe, expect, it } from 'vitest';
import {
  countIn,
  countInRichText,
  replaceIn,
  replaceInRichText,
  searchPattern,
  snippetsIn,
} from './search-replace';

const opts = (over = {}) => ({
  find: 'Mornington Green',
  replace: 'Living Legacy Mornington',
  matchCase: false,
  wholeWords: false,
  ...over,
});

describe('searchPattern', () => {
  it('ignores case unless asked, and treats the phrase as plain text', () => {
    expect(countIn('mornington green and MORNINGTON GREEN', searchPattern(opts()))).toBe(2);
    expect(countIn('mornington green', searchPattern(opts({ matchCase: true })))).toBe(0);
    expect(countIn('a.b and axb', searchPattern(opts({ find: 'a.b' })))).toBe(1);
  });

  it('matches whole words only when asked', () => {
    const text = 'Tree, trees and street';
    expect(countIn(text, searchPattern(opts({ find: 'tree' })))).toBe(3);
    expect(countIn(text, searchPattern(opts({ find: 'tree', wholeWords: true })))).toBe(1);
    expect(countIn('Café', searchPattern(opts({ find: 'caf', wholeWords: true })))).toBe(0);
  });
});

describe('replaceIn', () => {
  it('replaces every match and takes the replacement literally', () => {
    const p = searchPattern(opts());
    expect(replaceIn('Visit Mornington Green. mornington green!', p, 'X')).toBe('Visit X. X!');
    expect(replaceIn('Mornington Green', p, '$& $1')).toBe('$& $1');
  });
});

describe('rich text', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Welcome to Mornington Green, ' },
          { type: 'text', text: 'Mornington Green', marks: [{ type: 'bold' }] },
        ],
      },
      { type: 'image', attrs: { src: '/mornington-green.jpg', alt: 'x' } },
    ],
  };

  it('counts and replaces inside text only, keeping marks and attributes', () => {
    const p = searchPattern(opts());
    expect(countInRichText(doc, p)).toBe(2);
    const next = replaceInRichText(doc, p, 'Living Legacy Mornington');
    expect(next.content[0]!.content![1]).toEqual({
      type: 'text',
      text: 'Living Legacy Mornington',
      marks: [{ type: 'bold' }],
    });
    expect(next.content[1]).toEqual(doc.content[1]);
    // The original is left as it was.
    expect(doc.content[0]!.content![0]!.text).toBe('Welcome to Mornington Green, ');
  });
});

describe('snippetsIn', () => {
  it('shows each match with some text either side', () => {
    const p = searchPattern(opts());
    const [s] = snippetsIn(['A long way to Mornington Green from here'], p, 3, 10);
    expect(s).toEqual({ before: '…ng way to ', match: 'Mornington Green', after: ' from here' });
  });

  it('stops at the limit', () => {
    const p = searchPattern(opts({ find: 'a' }));
    expect(snippetsIn(['a a a a a'], p, 2)).toHaveLength(2);
  });
});

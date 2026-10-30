import { describe, expect, it } from 'vitest';
import { splitTags, toTag } from './faqs';

describe('toTag', () => {
  it('makes a lowercase, hyphenated code', () => {
    expect(toTag('  Mornington Green! ')).toBe('mornington-green');
    expect(toTag('Café FAQ')).toBe('cafe-faq');
    expect(toTag('---')).toBe('');
  });
});

describe('splitTags', () => {
  it('drops blanks and repeats, keeping order', () => {
    expect(splitTags('Home, pricing,, home , Wellington Dam')).toEqual([
      'home',
      'pricing',
      'wellington-dam',
    ]);
  });
});

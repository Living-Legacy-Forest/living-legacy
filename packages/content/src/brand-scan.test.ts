import { describe, expect, it } from 'vitest';
import { scanBrand } from './brand-scan';
import type { RichTextDoc } from './posts';

const doc = (text: string, alt?: string): RichTextDoc => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text }] },
    ...(alt ? [{ type: 'image', attrs: { src: '/a.jpg', alt } }] : []),
  ],
});

describe('scanBrand', () => {
  it('passes clean wording', () => {
    expect(scanBrand(['Living Legacy Mornington', doc('A quiet place to remember.')])).toBeNull();
  });

  it('fails an item that uses a word the guide never allows, naming what to write instead', () => {
    const result = scanBrand(['A final resting place', null]);
    expect(result?.never).toEqual([
      {
        found: 'final resting place',
        count: 1,
        instead: 'Legacy Ground, or their tree',
        kind: 'term',
      },
    ]);
  });

  it('reads the text and the image descriptions of a rich text document', () => {
    const result = scanBrand([doc('A kind welcome.', 'A grave with flowers')]);
    expect(result?.never.map((f) => f.found)).toEqual(['grave']);
  });

  it('counts a word that appears in two places once per place, not twice for a repeated title', () => {
    const result = scanBrand(['Plots available', 'Plots available', doc('More about plots.')]);
    expect(result?.never).toEqual([
      { found: 'Plots', count: 2, instead: 'Legacy Ground, or their tree', kind: 'term' },
    ]);
  });

  it('fails a misspelt product name', () => {
    const result = scanBrand(['Our EARTHSAPHE treatment']);
    expect(result?.never).toEqual([
      { found: 'EARTHSAPHE', count: 1, instead: 'EarthSApHE', kind: 'spelling' },
    ]);
  });

  it('does not fail on a word that is only usually wrong, but counts it', () => {
    expect(scanBrand(['Our liquid is gentle.'])).toBeNull();
    const both = scanBrand(['No plots, just a liquid.']);
    expect(both?.avoid).toBe(1);
  });

  it('uses the rules it is given', () => {
    const rules = [
      { match: 'forever home', instead: 'Legacy Ground', severity: 'critical' as const },
    ];
    expect(scanBrand(['A forever home'], rules)?.never[0]?.found).toBe('forever home');
    expect(scanBrand(['A final resting place'], rules)).toBeNull();
  });

  it('has nothing to judge when there is no text', () => {
    expect(scanBrand([null, undefined, '  ', doc('')])).toBeNull();
  });
});

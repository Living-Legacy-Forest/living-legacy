import { describe, expect, it } from 'vitest';
import { sentenceAround } from './brand-context';

describe('sentenceAround', () => {
  it('returns the sentence holding the word', () => {
    expect(sentenceAround('We plant trees. Each plot is mapped. Visit soon.', 'plot')).toBe(
      'Each plot is mapped.'
    );
  });

  it('matches case-insensitively and keeps the original casing', () => {
    expect(sentenceAround('Plots are shaded', 'plots')).toBe('Plots are shaded');
  });

  it('does not match inside another word', () => {
    expect(sentenceAround('A plotted course.', 'plot')).toBeNull();
  });

  it('is null when the phrase is absent', () => {
    expect(sentenceAround('Nothing here.', 'grave')).toBeNull();
  });

  it('splits on a new line as well as on full stops', () => {
    expect(sentenceAround('A calm morning\nChoose a plot today', 'plot')).toBe(
      'Choose a plot today'
    );
  });
});

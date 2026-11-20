import { BRAND_RULES } from '@ll/content';
import { describe, expect, it } from 'vitest';
import { guardProblems } from './guard';

const opts = { limit: 60, rules: BRAND_RULES };

describe('guardProblems', () => {
  it('passes wording that follows the guide', () => {
    expect(guardProblems('A quiet walk through Living Legacy Mornington', opts)).toEqual([]);
  });

  it('flags a word the guide never allows and says what to write instead', () => {
    const problems = guardProblems('Choose a plot', opts);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Do not use "plot"');
    expect(problems[0]).toContain('Legacy Ground, or their tree');
  });

  it('flags an em dash and an en dash', () => {
    expect(guardProblems('Calm — and green', opts)[0]).toMatch(/dash/i);
    expect(guardProblems('2020–2024', opts)[0]).toMatch(/dash/i);
  });

  it('flags an exclamation mark', () => {
    expect(guardProblems('Visit us!', opts)[0]).toMatch(/exclamation/i);
  });

  it('flags text over the limit and says by how much', () => {
    const problems = guardProblems('a'.repeat(61), opts);
    expect(problems[0]).toContain('61');
    expect(problems[0]).toContain('60');
  });

  it('flags a name that is not in the allowed list', () => {
    const problems = guardProblems('Gardening', { ...opts, allowed: ['Events', 'Forests'] });
    expect(problems[0]).toContain('Gardening');
  });

  it('accepts an allowed name in any case', () => {
    expect(guardProblems('events', { ...opts, allowed: ['Events'] })).toEqual([]);
  });

  it('flags empty text', () => {
    expect(guardProblems('   ', opts)[0]).toMatch(/empty/i);
  });
});

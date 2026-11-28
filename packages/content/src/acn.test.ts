import { describe, expect, it } from 'vitest';
import { formatAcn, isValidAcn } from './acn';

describe('isValidAcn', () => {
  it('accepts a number whose check digit fits, with or without spaces', () => {
    expect(isValidAcn('000 000 019')).toBe(true);
    expect(isValidAcn('000000019')).toBe(true);
    expect(isValidAcn('004 085 616')).toBe(true);
  });

  it('rejects a wrong check digit and the wrong length', () => {
    expect(isValidAcn('000 000 018')).toBe(false);
    expect(isValidAcn('00 000 019')).toBe(false);
    expect(isValidAcn('abc')).toBe(false);
  });
});

describe('formatAcn', () => {
  it('groups nine digits as 3-3-3 and leaves anything else as typed', () => {
    expect(formatAcn('000000019')).toBe('000 000 019');
    expect(formatAcn(' 12 ')).toBe('12');
  });
});

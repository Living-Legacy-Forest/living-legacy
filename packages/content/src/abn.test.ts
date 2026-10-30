import { describe, expect, it } from 'vitest';
import { formatAbn, isValidAbn } from './abn';

describe('isValidAbn', () => {
  it('accepts a real ABN with or without spaces', () => {
    expect(isValidAbn('59 639 330 617')).toBe(true);
    expect(isValidAbn('59639330617')).toBe(true);
  });

  it('rejects a wrong check digit or length', () => {
    expect(isValidAbn('59 639 330 618')).toBe(false);
    expect(isValidAbn('5963933061')).toBe(false);
    expect(isValidAbn('abc')).toBe(false);
  });
});

describe('formatAbn', () => {
  it('groups the digits 2-3-3-3', () => {
    expect(formatAbn('59639330617')).toBe('59 639 330 617');
    expect(formatAbn(' 123 ')).toBe('123');
  });
});

import { describe, expect, it } from 'vitest';
import { pageSizeParam } from './page-size';

describe('pageSizeParam', () => {
  const param = pageSizeParam([10, 25, 50] as const);

  it('keeps a size on offer', () => {
    expect(param.parse(25)).toBe(25);
  });

  it('drops a size nobody offered, so the usual one applies', () => {
    expect(param.parse(7)).toBeUndefined();
    expect(param.parse(1000)).toBeUndefined();
  });

  it('drops what is not a number', () => {
    expect(param.parse('25')).toBeUndefined();
    expect(param.parse(null)).toBeUndefined();
  });

  it('allows it to be left out', () => {
    expect(param.parse(undefined)).toBeUndefined();
  });
});

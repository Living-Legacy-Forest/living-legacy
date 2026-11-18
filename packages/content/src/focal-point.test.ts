import { describe, expect, it } from 'vitest';
import { focalPosition } from './focal-point';

describe('focalPosition', () => {
  it('turns a point into an object-position', () => {
    expect(focalPosition(0.25, 0.75)).toBe('25% 75%');
    expect(focalPosition(0, 1)).toBe('0% 100%');
    expect(focalPosition(0.333, 0.667)).toBe('33% 67%');
  });

  it('leaves an image centred when there is no point, or only half of one', () => {
    expect(focalPosition(null, null)).toBeUndefined();
    expect(focalPosition(undefined, undefined)).toBeUndefined();
    expect(focalPosition(0.5, null)).toBeUndefined();
    expect(focalPosition(null, 0.5)).toBeUndefined();
  });

  it('holds values to the image and ignores junk', () => {
    expect(focalPosition(-1, 2)).toBe('0% 100%');
    expect(focalPosition(Number.NaN, 0.5)).toBeUndefined();
    expect(focalPosition(Infinity, 0.5)).toBeUndefined();
  });
});

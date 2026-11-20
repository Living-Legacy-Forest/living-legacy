import { describe, expect, it } from 'vitest';
import {
  MAX_SHARE,
  MIN_SHARE,
  clampShare,
  parseStoredShare,
  shareFromPointer,
  stepShare,
} from './split-share';

describe('clampShare', () => {
  it('keeps both columns usable', () => {
    expect(clampShare(0.05)).toBe(MIN_SHARE);
    expect(clampShare(0.95)).toBe(MAX_SHARE);
    expect(clampShare(0.5)).toBe(0.5);
  });
});

describe('shareFromPointer', () => {
  const rect = { left: 100, width: 1000 };

  it('is how far across the frame the pointer is', () => {
    expect(shareFromPointer(600, rect)).toBeCloseTo(0.5);
    expect(shareFromPointer(400, rect)).toBeCloseTo(0.3);
  });

  it('stays within the limits when dragged past either end', () => {
    expect(shareFromPointer(0, rect)).toBe(MIN_SHARE);
    expect(shareFromPointer(5000, rect)).toBe(MAX_SHARE);
  });

  it('does not divide by a frame with no width', () => {
    expect(shareFromPointer(10, { left: 0, width: 0 })).toBe(MIN_SHARE);
  });
});

describe('stepShare', () => {
  it('moves by two points, or ten with Shift, and stays within the limits', () => {
    expect(stepShare(0.5, 'right', false)).toBeCloseTo(0.52);
    expect(stepShare(0.5, 'left', false)).toBeCloseTo(0.48);
    expect(stepShare(0.5, 'right', true)).toBeCloseTo(0.6);
    expect(stepShare(MAX_SHARE, 'right', true)).toBe(MAX_SHARE);
    expect(stepShare(MIN_SHARE, 'left', true)).toBe(MIN_SHARE);
  });
});

describe('parseStoredShare', () => {
  it('reads a saved number within the limits', () => {
    expect(parseStoredShare('0.62', 0.5)).toBeCloseTo(0.62);
  });

  it('falls back for nothing, rubbish or a number out of range', () => {
    expect(parseStoredShare(null, 0.5)).toBe(0.5);
    expect(parseStoredShare('wide', 0.5)).toBe(0.5);
    expect(parseStoredShare('7', 0.5)).toBe(0.5);
    expect(parseStoredShare('0', 0.5)).toBe(0.5);
  });
});

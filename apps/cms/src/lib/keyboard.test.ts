import type { KeyboardEvent } from 'react';
import { describe, expect, it } from 'vitest';

import { isComposing, isEnterKey } from './keyboard';

const key = (k: string, { composing = false, keyCode = 13 } = {}) =>
  ({ key: k, keyCode, nativeEvent: { isComposing: composing } }) as unknown as KeyboardEvent;

describe('isEnterKey', () => {
  it('accepts a plain Enter', () => {
    expect(isEnterKey(key('Enter'))).toBe(true);
  });

  it('ignores Enter that confirms an input-method candidate', () => {
    expect(isEnterKey(key('Enter', { composing: true }))).toBe(false);
  });

  it('ignores the confirming Enter Safari reports with key code 229', () => {
    expect(isEnterKey(key('Enter', { keyCode: 229 }))).toBe(false);
  });

  it('ignores other keys', () => {
    expect(isEnterKey(key('a', { keyCode: 65 }))).toBe(false);
  });
});

describe('isComposing', () => {
  it('is false for ordinary typing', () => {
    expect(isComposing(key(',', { keyCode: 188 }))).toBe(false);
  });
});

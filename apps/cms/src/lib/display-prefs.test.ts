import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_PREFS,
  displayAttributes,
  parseDisplayPrefs,
  serialiseDisplayPrefs,
} from './display-prefs';

describe('display preferences', () => {
  it('round-trips through the cookie', () => {
    const prefs = {
      textSize: 'large',
      pointerCursors: true,
      underlineLinks: false,
      reduceMotion: true,
    } as const;
    expect(serialiseDisplayPrefs(prefs)).toBe('2101');
    expect(parseDisplayPrefs(`a=b; display_prefs=2101; c=d`)).toEqual(prefs);
  });

  it('falls back to the defaults for a missing or damaged cookie', () => {
    expect(parseDisplayPrefs('')).toEqual(DEFAULT_DISPLAY_PREFS);
    expect(parseDisplayPrefs('display_prefs=9999')).toEqual(DEFAULT_DISPLAY_PREFS);
    expect(parseDisplayPrefs('display_prefs=21')).toEqual(DEFAULT_DISPLAY_PREFS);
  });

  it('leaves the page alone when everything is at its default', () => {
    expect(Object.values(displayAttributes(DEFAULT_DISPLAY_PREFS))).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

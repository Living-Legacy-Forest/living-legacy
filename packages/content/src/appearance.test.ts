import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  appearanceVars,
  grainImage,
  parseAppearance,
  tintValues,
} from './appearance';

describe('parseAppearance', () => {
  it('follows the site for an empty or unreadable column', () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('')).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('not json')).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('{"colour":{"hue":400,"strength":1},"grain":null}')).toEqual(
      DEFAULT_APPEARANCE
    );
  });

  it('reads a stored choice', () => {
    const stored = { colour: { hue: 150, strength: 0.5 }, grain: 0.3 };
    expect(parseAppearance(JSON.stringify(stored))).toEqual(stored);
  });
});

describe('tintValues', () => {
  it('runs from a near-neutral grey to a saturated colour', () => {
    expect(tintValues({ hue: 150, strength: 0 })).toEqual({ h: 150, c: 0, l: 0.3, lDark: 0.9 });
    expect(tintValues({ hue: 150, strength: 1 })).toEqual({
      h: 150,
      c: 0.16,
      l: 0.54,
      lDark: 0.74,
    });
  });
});

describe('appearanceVars', () => {
  it('sets nothing when following the site', () => {
    expect(appearanceVars(DEFAULT_APPEARANCE)).toEqual({});
  });

  it('sets the tint and grain that were chosen', () => {
    const vars = appearanceVars({ colour: { hue: 20, strength: 0.5 }, grain: 0 });
    expect(vars['--tint-h']).toBe('20');
    expect(vars['--grain-light']).toBe('none');
    expect(vars['--grain-dark']).toBe('none');
  });

  it('draws grain as an inline image', () => {
    expect(grainImage(0.11)).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(decodeURIComponent(grainImage(0.11))).toContain("opacity='0.11'");
  });
});

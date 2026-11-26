import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  appearanceVars,
  grainImage,
  iconStrokePx,
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
    const stored = {
      colour: { hue: 150, strength: 0.5 },
      grain: 0.3,
      contrast: 0.6,
      iconStroke: 0.8,
    };
    expect(parseAppearance(JSON.stringify(stored))).toEqual(stored);
  });

  it('reads a choice saved before contrast existed as the default contrast', () => {
    const stored = { colour: { hue: 150, strength: 0.5 }, grain: 0.3 };
    expect(parseAppearance(JSON.stringify(stored))).toEqual({
      ...stored,
      contrast: null,
      iconStroke: null,
    });
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

describe('iconStrokePx', () => {
  it('runs from 1.25 to 2.5, with the default setting at 2', () => {
    expect(iconStrokePx(0)).toBe(1.25);
    expect(iconStrokePx(0.6)).toBe(2);
    expect(iconStrokePx(1)).toBe(2.5);
  });
});

describe('appearanceVars', () => {
  it('sets nothing when following the site', () => {
    expect(appearanceVars(DEFAULT_APPEARANCE)).toEqual({});
  });

  it('sets the tint and grain that were chosen', () => {
    const vars = appearanceVars({
      colour: { hue: 20, strength: 0.5 },
      grain: 0,
      contrast: null,
      iconStroke: null,
    });
    expect(vars['--tint-h']).toBe('20');
    expect(vars['--grain-light']).toBe('none');
    expect(vars['--grain-dark']).toBe('none');
  });

  it('sets contrast only when it was chosen', () => {
    const none = { colour: null, grain: null, contrast: null, iconStroke: null };
    expect(appearanceVars(none)).toEqual({});
    expect(appearanceVars({ ...none, contrast: 0 })['--contrast']).toBe('0');
    expect(appearanceVars({ ...none, contrast: 0.75 })['--contrast']).toBe('0.75');
  });

  it('sets the icon stroke only when it was chosen', () => {
    const none = { colour: null, grain: null, contrast: null, iconStroke: null };
    expect(appearanceVars(none)).toEqual({});
    expect(appearanceVars({ ...none, iconStroke: 0 })['--icon-stroke-default']).toBe('1.25');
    expect(appearanceVars({ ...none, iconStroke: 1 })['--icon-stroke-default']).toBe('2.5');
  });

  it('draws grain as an inline image', () => {
    expect(grainImage(0.11)).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(decodeURIComponent(grainImage(0.11))).toContain("opacity='0.11'");
  });
});

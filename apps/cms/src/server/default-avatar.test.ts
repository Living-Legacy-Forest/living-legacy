import { describe, expect, it } from 'vitest';
import { defaultAvatarSvg, isAvatarSeed } from './default-avatar';

describe('defaultAvatarSvg', () => {
  it('draws the same face for the same id', () => {
    expect(defaultAvatarSvg('01M6ZCV4YXAFHMPNF4FSD86QA9')).toBe(
      defaultAvatarSvg('01M6ZCV4YXAFHMPNF4FSD86QA9')
    );
  });

  it('draws different faces for different ids', () => {
    expect(defaultAvatarSvg('user-a')).not.toBe(defaultAvatarSvg('user-b'));
  });

  it('is a plain SVG with nothing that runs', () => {
    const svg = defaultAvatarSvg('user-a');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/<script|on\w+=/i);
  });
});

describe('isAvatarSeed', () => {
  it('accepts ids and refuses anything else', () => {
    expect(isAvatarSeed('01M6ZCV4YXAFHMPNF4FSD86QA9')).toBe(true);
    expect(isAvatarSeed('aB3_x-9')).toBe(true);
    expect(isAvatarSeed('../etc')).toBe(false);
    expect(isAvatarSeed('')).toBe(false);
    expect(isAvatarSeed('x'.repeat(65))).toBe(false);
  });
});

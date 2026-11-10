import { describe, expect, it } from 'vitest';
import { avatarSrc, randomAvatarSeeds } from './avatar';

describe('avatarSrc', () => {
  it('prefers an uploaded photo', () => {
    expect(avatarSrc({ image: '/api/avatar/abc', avatarSeed: 'k3x9' })).toBe('/api/avatar/abc');
  });

  it('uses a chosen avatar when there is no photo', () => {
    expect(avatarSrc({ image: null, avatarSeed: 'k3x9' })).toBe('/api/avatars/k3x9');
  });

  it('shows nothing (so initials) when neither is chosen', () => {
    expect(avatarSrc({ image: null, avatarSeed: null })).toBeUndefined();
    expect(avatarSrc({ image: '', avatarSeed: '' })).toBeUndefined();
  });

  it('never builds a path from a seed that is not one', () => {
    expect(avatarSrc({ image: null, avatarSeed: '../../x' })).toBeUndefined();
  });
});

describe('randomAvatarSeeds', () => {
  it('gives as many different, valid seeds as asked', () => {
    const seeds = randomAvatarSeeds(24);
    expect(new Set(seeds).size).toBe(24);
    for (const seed of seeds) expect(seed).toMatch(/^[a-z0-9]{10}$/);
  });
});

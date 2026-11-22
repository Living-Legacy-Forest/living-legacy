import { describe, expect, it } from 'vitest';
import { BANNER_ASPECT, bannerHueShift, bannerKey, bannerUrl, imageFailed } from './banner';

describe('bannerKey', () => {
  it('reads the storage key from a banner url', () => {
    expect(bannerKey('/api/banner/banner-3f2a-9b.webp')).toBe('banner-3f2a-9b.webp');
  });

  it.each([
    '/api/avatar/avatar-x.png',
    '/api/banner/banner-a.png?x=1',
    '/api/banner/../banner-a.png',
    'https://evil.test/api/banner/banner-a.png',
    '/api/banner/banner-.PNG',
    '',
    null,
    undefined,
  ])('refuses %s', (url) => {
    expect(bannerKey(url)).toBeNull();
  });

  it('round-trips with bannerUrl', () => {
    expect(bannerKey(bannerUrl('banner-a.png'))).toBe('banner-a.png');
  });
});

describe('bannerHueShift', () => {
  const seeds = ['', ...Array.from({ length: 49 }, (_, i) => `user-${i * 7919}`)];

  it('is stable for a seed', () => {
    expect(bannerHueShift('abc')).toBe(bannerHueShift('abc'));
  });

  it('is a whole number from 0 to 40', () => {
    for (const seed of seeds) {
      const shift = bannerHueShift(seed);
      expect(Number.isInteger(shift)).toBe(true);
      expect(shift).toBeGreaterThanOrEqual(0);
      expect(shift).toBeLessThanOrEqual(40);
    }
  });

  it('differs between people', () => {
    expect(new Set(seeds.map(bannerHueShift)).size).toBeGreaterThanOrEqual(5);
  });
});

it('crops banners wide', () => {
  expect(BANNER_ASPECT).toBe(3);
});

describe('imageFailed', () => {
  it('spots an image that failed before the page could listen', () => {
    expect(imageFailed({ complete: true, naturalWidth: 0 })).toBe(true);
  });

  it('leaves loaded and still-loading images alone', () => {
    expect(imageFailed({ complete: true, naturalWidth: 1500 })).toBe(false);
    expect(imageFailed({ complete: false, naturalWidth: 0 })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { renamedFilename, splitFilename } from './filename';

describe('splitFilename', () => {
  it('separates the extension', () => {
    expect(splitFilename('forest-ceremony.jpg')).toEqual({ base: 'forest-ceremony', ext: '.jpg' });
    expect(splitFilename('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: '.gz' });
  });

  it('treats a leading dot or no dot as no extension', () => {
    expect(splitFilename('.hidden')).toEqual({ base: '.hidden', ext: '' });
    expect(splitFilename('README')).toEqual({ base: 'README', ext: '' });
  });
});

describe('renamedFilename', () => {
  it('keeps the original extension whatever is typed', () => {
    expect(renamedFilename('IMG_0042.jpg', 'Planting day')).toBe('Planting day.jpg');
    expect(renamedFilename('IMG_0042.jpg', 'planting.png')).toBe('planting.png.jpg');
  });

  it('strips slashes, control characters and extra spaces', () => {
    expect(renamedFilename('a.webp', '  forest / day\\one\u0000  ')).toBe('forest day one.webp');
  });

  it('caps the name at 120 characters before the extension', () => {
    expect(renamedFilename('a.png', 'x'.repeat(200))).toBe(`${'x'.repeat(120)}.png`);
  });

  it('refuses an empty name', () => {
    expect(() => renamedFilename('a.png', ' / ')).toThrow('Give the file a name.');
  });
});

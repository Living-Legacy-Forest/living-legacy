import { describe, expect, it } from 'vitest';
import { findOrphans } from './media-sweep';

const now = new Date('2026-11-05T03:00:00Z');
const old = new Date('2026-11-01T00:00:00Z');
const recent = new Date('2026-11-05T02:30:00Z');

describe('findOrphans', () => {
  it('lists stored files nothing points at, once they are a day old', () => {
    const result = findOrphans(
      [
        { key: 'media/a.webp', uploaded: old },
        { key: 'media/a-w640.webp', uploaded: old },
        { key: 'media/gone.webp', uploaded: old },
        { key: 'media/uploading.webp', uploaded: recent },
      ],
      new Set(['media/a.webp', 'media/a-w640.webp']),
      now
    );
    expect(result).toEqual({ orphans: ['media/gone.webp'], refused: false });
  });

  it('refuses when most files look orphaned, which points at a bad lookup', () => {
    const objects = ['a', 'b', 'c', 'd'].map((key) => ({ key, uploaded: old }));
    expect(findOrphans(objects, new Set(['a']), now)).toEqual({ orphans: [], refused: true });
  });

  it('has nothing to do for an empty bucket', () => {
    expect(findOrphans([], new Set(), now)).toEqual({ orphans: [], refused: false });
  });
});

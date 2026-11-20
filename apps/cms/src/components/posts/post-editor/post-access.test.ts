import { describe, expect, it } from 'vitest';
import { postAccessFor } from './post-access';

describe('postAccessFor', () => {
  it('gives a viewer who was given posts:publish full access', () => {
    const viewer = {
      id: 'u1',
      role: 'viewer' as const,
      extraPermissions: ['posts:publish' as const],
    };
    expect(postAccessFor(viewer, 'someone-else')).toBe('full');
  });

  it("gives an author who was given seo:write the SEO view of someone else's post", () => {
    const author = { id: 'u1', role: 'author' as const, extraPermissions: ['seo:write' as const] };
    expect(postAccessFor(author, 'someone-else')).toBe('seo');
  });

  it('keeps a plain author to their own posts', () => {
    const author = { id: 'u1', role: 'author' as const };
    expect(postAccessFor(author, 'u1')).toBe('author');
    expect(postAccessFor(author, 'someone-else')).toBe('readonly');
  });

  it('keeps a viewer read-only', () => {
    expect(postAccessFor({ id: 'u1', role: 'viewer' }, 'u1')).toBe('readonly');
  });
});

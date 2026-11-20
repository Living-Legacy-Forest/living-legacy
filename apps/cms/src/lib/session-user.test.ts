import { describe, expect, it } from 'vitest';
import { toSessionUser } from './session-user';

const raw = {
  id: 'u1',
  name: 'Sam',
  email: 'sam@example.test',
  image: null,
  imageAlt: null,
  bio: null,
  avatarSeed: null,
  createdAt: new Date('2026-01-02T00:00:00Z'),
};

describe('toSessionUser', () => {
  it('reads the role and the JSON extras the database stores', () => {
    const user = toSessionUser({
      ...raw,
      role: 'author',
      extraPermissions: '["redirects:write"]',
    });
    expect(user.role).toBe('author');
    expect(user.extraPermissions).toEqual(['redirects:write']);
    expect(user.createdAt).toBe(new Date('2026-01-02T00:00:00Z').getTime());
  });

  it('treats malformed extras as none', () => {
    expect(toSessionUser({ ...raw, role: 'editor', extraPermissions: '{not json' })).toMatchObject({
      role: 'editor',
      extraPermissions: [],
    });
  });

  it('treats missing extras as none', () => {
    expect(toSessionUser({ ...raw, role: 'seo' }).extraPermissions).toEqual([]);
    expect(toSessionUser({ ...raw, role: 'seo', extraPermissions: null }).extraPermissions).toEqual(
      []
    );
  });

  it('makes an unknown or missing role a viewer, and keeps its extras', () => {
    expect(
      toSessionUser({ ...raw, role: 'wizard', extraPermissions: '["seo:write"]' })
    ).toMatchObject({ role: 'viewer', extraPermissions: ['seo:write'] });
    expect(toSessionUser({ ...raw, role: null }).role).toBe('viewer');
    expect(toSessionUser({ ...raw }).role).toBe('viewer');
  });

  it('keeps the other details and fills missing ones with null', () => {
    expect(toSessionUser({ ...raw, role: 'viewer', image: 'a.png', bio: 'Hi' })).toMatchObject({
      id: 'u1',
      name: 'Sam',
      email: 'sam@example.test',
      image: 'a.png',
      imageAlt: null,
      bio: 'Hi',
      avatarSeed: null,
    });
  });
});

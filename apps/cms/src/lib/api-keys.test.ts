import { describe, expect, it } from 'vitest';
import { canWrite, generateApiKey, hashApiKey } from './api-keys';

describe('generateApiKey', () => {
  it('makes an llk_ key from 32 random bytes, URL-safe', () => {
    const { key, prefix } = generateApiKey();
    expect(key).toMatch(/^llk_[A-Za-z0-9_-]{43}$/);
    expect(prefix).toBe(key.slice(0, 12));
  });

  it('never repeats', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });
});

describe('canWrite', () => {
  it('lets a write key held by someone given posts:write create drafts', () => {
    expect(canWrite({ scope: 'write', role: 'viewer', extraPermissions: ['posts:write'] })).toBe(
      true
    );
  });

  it('refuses a write key held by someone who cannot write posts', () => {
    expect(canWrite({ scope: 'write', role: 'viewer' })).toBe(false);
  });

  it('refuses a read key whatever its holder can do', () => {
    expect(canWrite({ scope: 'read', role: 'admin' })).toBe(false);
  });
});

describe('hashApiKey', () => {
  it('is the hex SHA-256 of the key', async () => {
    // printf %s abc | shasum -a 256
    expect(await hashApiKey('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

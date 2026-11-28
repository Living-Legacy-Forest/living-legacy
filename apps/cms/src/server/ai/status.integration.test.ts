// Whether the Suggest buttons show: the key, the Settings switch and the person's role.
import { siteSettings } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../../test/fixtures';
import { assistantStatusFor } from './status';

const setKey = (key?: string) => {
  (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY = key;
};

beforeEach(async () => {
  await testDb().delete(siteSettings);
  setKey(undefined);
});

const allOn = { searchText: true, summaries: true, tags: true, imageText: true, brandFixes: true };

describe('assistantStatusFor', () => {
  it('is on for an editor when the key is set and Settings has not turned it off', async () => {
    setKey('test-key');
    expect(await assistantStatusFor(testDb(), { role: 'editor' })).toEqual({
      enabled: true,
      keySet: true,
      switchedOn: true,
      groups: allOn,
    });
  });

  it('says which kinds of suggestion an admin has switched off', async () => {
    setKey('test-key');
    await testDb()
      .insert(siteSettings)
      .values({ id: 'site', data: { aiImageText: false, aiTags: false } });
    expect((await assistantStatusFor(testDb(), { role: 'editor' })).groups).toEqual({
      ...allOn,
      imageText: false,
      tags: false,
    });
  });

  it('is off for a role that cannot edit anything', async () => {
    setKey('test-key');
    expect((await assistantStatusFor(testDb(), { role: 'viewer' })).enabled).toBe(false);
  });

  it('is off without a key, and says so', async () => {
    expect(await assistantStatusFor(testDb(), { role: 'admin' })).toEqual({
      enabled: false,
      keySet: false,
      switchedOn: true,
      groups: allOn,
    });
  });

  it('is off when an admin has switched it off in Settings', async () => {
    setKey('test-key');
    await testDb()
      .insert(siteSettings)
      .values({ id: 'site', data: { aiEnabled: false } });
    expect(await assistantStatusFor(testDb(), { role: 'admin' })).toEqual({
      enabled: false,
      keySet: true,
      switchedOn: false,
      groups: allOn,
    });
  });
});

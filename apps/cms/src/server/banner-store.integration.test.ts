import { user } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { adoptBanner, removeBanner } from './banner-store';

const url = (key: string) => `/api/banner/${key}`;
const BAD = 'That banner could not be used.';

async function putBanner(key: string, ownerId: string) {
  await env.MEDIA.put(key, 'x', { customMetadata: { userId: ownerId } });
}
const exists = async (key: string) => (await env.MEDIA.head(key)) !== null;
const bannerOf = async (id: string) =>
  (await testDb().query.user.findFirst({ where: eq(user.id, id) }))!.banner;

beforeEach(async () => {
  const listed = await env.MEDIA.list();
  if (listed.objects.length) await env.MEDIA.delete(listed.objects.map((o) => o.key));
});

describe('adoptBanner', () => {
  it("saves the caller's own uploaded file and keeps it", async () => {
    const me = await addUser();
    await putBanner('banner-a.webp', me);
    await adoptBanner(testDb(), me, null, url('banner-a.webp'));
    expect(await bannerOf(me)).toBe(url('banner-a.webp'));
    expect(await exists('banner-a.webp')).toBe(true);
  });

  it("refuses another person's file and changes nothing", async () => {
    const me = await addUser();
    const other = await addUser();
    await putBanner('banner-mine.webp', me);
    await adoptBanner(testDb(), me, null, url('banner-mine.webp'));
    await putBanner('banner-theirs.webp', other);

    await expect(
      adoptBanner(testDb(), me, url('banner-mine.webp'), url('banner-theirs.webp'))
    ).rejects.toThrow(BAD);
    expect(await bannerOf(me)).toBe(url('banner-mine.webp'));
    expect(await exists('banner-mine.webp')).toBe(true);
    expect(await exists('banner-theirs.webp')).toBe(true);
  });

  it('refuses a url that is not a banner, or a banner with no file', async () => {
    const me = await addUser();
    await expect(adoptBanner(testDb(), me, null, '/api/avatar/avatar-x.png')).rejects.toThrow(BAD);
    await expect(adoptBanner(testDb(), me, null, url('banner-missing.webp'))).rejects.toThrow(BAD);
    expect(await bannerOf(me)).toBeNull();
  });

  it('deletes the old file when replacing, but never one tagged to someone else', async () => {
    const me = await addUser();
    const other = await addUser();
    await putBanner('banner-old.webp', me);
    await putBanner('banner-new.webp', me);
    await adoptBanner(testDb(), me, url('banner-old.webp'), url('banner-new.webp'));
    expect(await exists('banner-old.webp')).toBe(false);

    await putBanner('banner-foreign.webp', other);
    await putBanner('banner-newer.webp', me);
    await adoptBanner(testDb(), me, url('banner-foreign.webp'), url('banner-newer.webp'));
    expect(await exists('banner-foreign.webp')).toBe(true);
  });
});

describe('removeBanner', () => {
  it("deletes the caller's file and clears the column", async () => {
    const me = await addUser();
    await putBanner('banner-a.webp', me);
    await adoptBanner(testDb(), me, null, url('banner-a.webp'));
    await removeBanner(testDb(), me, url('banner-a.webp'));
    expect(await bannerOf(me)).toBeNull();
    expect(await exists('banner-a.webp')).toBe(false);
  });

  it('leaves a file tagged to someone else', async () => {
    const me = await addUser();
    const other = await addUser();
    await putBanner('banner-theirs.webp', other);
    await removeBanner(testDb(), me, url('banner-theirs.webp'));
    expect(await exists('banner-theirs.webp')).toBe(true);
  });
});

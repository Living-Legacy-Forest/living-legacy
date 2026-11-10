import { activityLog, media } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { withBrowserCache } from './media-delivery';
import { UploadError, replaceMediaFile, storeUpload } from './media-store';

/** Just enough of a PNG for imageSize: the signature and an IHDR chunk. */
function png(width: number, height: number, name = 'tree.png') {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.set(
    [...'IHDR'].map((c) => c.charCodeAt(0)),
    12
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], name, { type: 'image/png' });
}

function form(file: File) {
  const f = new FormData();
  f.set('file', file);
  return f;
}

let actor = { id: '', name: 'Sam Tester' };
const cleared = vi.fn(async (_key: Request) => true);
const origin = 'http://cms.test';

describe('replaceMediaFile', () => {
  beforeEach(async () => {
    await testDb().delete(media);
    await testDb().delete(activityLog);
    actor = { id: await addUser('editor'), name: 'Sam Tester' };
    // The edge cache only exists on Workers; record what a replace clears from it.
    vi.stubGlobal('caches', { default: { delete: cleared } });
    cleared.mockClear();
  });

  async function existing() {
    const stored = await storeUpload(form(png(800, 600, 'old.png')));
    const [row] = await testDb()
      .insert(media)
      .values({ ...stored, alt: 'A young tree', caption: 'Planted in spring' })
      .returning();
    return row!;
  }

  it('keeps the id, alt text and caption and swaps the file', async () => {
    const before = await existing();
    const stored = await storeUpload(form(png(1200, 900, 'new.png')));

    const after = await replaceMediaFile(testDb(), { id: before.id, stored, actor, origin });

    expect(after.id).toBe(before.id);
    expect(after.alt).toBe('A young tree');
    expect(after.caption).toBe('Planted in spring');
    expect(after).toMatchObject({ filename: 'new.png', width: 1200, height: 900 });
    expect(after.r2Key).not.toBe(before.r2Key);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(await env.MEDIA.head(after.r2Key)).not.toBeNull();
    expect(await env.MEDIA.head(before.r2Key)).toBeNull();
    expect(cleared).toHaveBeenCalledWith(new Request(`${origin}/api/media/${before.id}`));
  });

  it('records the replacement in the activity log', async () => {
    const before = await existing();
    const stored = await storeUpload(form(png(10, 10, 'new.png')));

    await replaceMediaFile(testDb(), { id: before.id, stored, actor, origin });

    const [entry] = await testDb()
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'media.replaced'));
    expect(entry?.summary).toBe('Replaced the file for old.png with new.png');
  });

  it('refuses an image that no longer exists and removes the new file', async () => {
    const stored = await storeUpload(form(png(10, 10)));

    await expect(
      replaceMediaFile(testDb(), { id: 'gone', stored, actor, origin })
    ).rejects.toBeInstanceOf(UploadError);
    expect(await env.MEDIA.head(stored.r2Key)).toBeNull();
  });
});

describe('storeUpload', () => {
  it('refuses a file that is not an image', async () => {
    const pdf = new File(['%PDF-1.7'], 'brochure.pdf', { type: 'application/pdf' });
    await expect(storeUpload(form(pdf))).rejects.toThrow('Only JPEG, PNG, WebP, AVIF and GIF');
  });
});

describe('browser caching of media', () => {
  const stored = () =>
    new Response('bytes', { headers: { ETag: '"abc"', 'Content-Type': 'image/png' } });

  it('keeps files for a day, since a file can be replaced under the same URL', () => {
    const res = withBrowserCache(stored(), new Request('http://cms.test/api/media/x'));
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('answers 304 when the browser already has this version', () => {
    const req = new Request('http://cms.test/api/media/x', {
      headers: { 'If-None-Match': '"abc"' },
    });
    expect(withBrowserCache(stored(), req).status).toBe(304);
  });

  it('sends the file again once it has changed', () => {
    const req = new Request('http://cms.test/api/media/x', {
      headers: { 'If-None-Match': '"old"' },
    });
    expect(withBrowserCache(stored(), req).status).toBe(200);
  });
});

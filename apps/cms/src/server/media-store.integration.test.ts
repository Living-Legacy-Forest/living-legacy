import { activityLog, media, mediaVersions } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { withBrowserCache } from './media-delivery';
import {
  UploadError,
  attachPdfCover,
  replaceMediaFile,
  restoreMediaVersion,
  storeUpload,
} from './media-store';

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
    await testDb().delete(mediaVersions);
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
    // The old file is kept as a version, so the replace can be undone.
    expect(await env.MEDIA.head(before.r2Key)).not.toBeNull();
    // Compared by URL: Request objects carry internals that differ between runtimes.
    expect(cleared.mock.calls.map(([key]) => key.url)).toContain(
      `${origin}/api/media/${before.id}`
    );
  });

  it('keeps the replaced file as a version, newest first, and no more than five', async () => {
    const row = await existing();
    for (let i = 0; i < 7; i++) {
      const stored = await storeUpload(form(png(20 + i, 20, `v${i}.png`)));
      await replaceMediaFile(testDb(), { id: row.id, stored, actor, origin });
      // Versions are told apart by when they were replaced.
      await new Promise((r) => setTimeout(r, 2));
    }
    const kept = await testDb()
      .select()
      .from(mediaVersions)
      .where(eq(mediaVersions.mediaId, row.id));
    expect(kept).toHaveLength(5);
    expect(kept.every((v) => v.replacedBy === actor.id)).toBe(true);
    // The two oldest (the original and the first replacement) are gone, files and all.
    expect(await env.MEDIA.head(row.r2Key)).toBeNull();
    for (const v of kept) expect(await env.MEDIA.head(v.r2Key)).not.toBeNull();
  });

  it('restores an earlier version, keeping the file it replaces as a version', async () => {
    const before = await existing();
    const stored = await storeUpload(form(png(1200, 900, 'new.png')));
    const replaced = await replaceMediaFile(testDb(), { id: before.id, stored, actor, origin });
    const [version] = await testDb().select().from(mediaVersions);

    await restoreMediaVersion(testDb(), {
      mediaId: before.id,
      versionId: version!.id,
      actor,
      origin,
    });

    const [after] = await testDb().select().from(media).where(eq(media.id, before.id));
    expect(after).toMatchObject({ filename: 'old.png', r2Key: before.r2Key, width: 800 });
    expect(after!.alt).toBe('A young tree');
    const versions = await testDb().select().from(mediaVersions);
    expect(versions.map((v) => v.r2Key)).toEqual([replaced.r2Key]);
    expect(await env.MEDIA.head(replaced.r2Key)).not.toBeNull();
    const [entry] = await testDb()
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'media.restored'));
    expect(entry?.summary).toBe('Restored old.png as the file for new.png');
  });

  it('refuses a version that belongs to another file', async () => {
    const one = await existing();
    const stored = await storeUpload(form(png(10, 10, 'a.png')));
    await replaceMediaFile(testDb(), { id: one.id, stored, actor, origin });
    const [version] = await testDb().select().from(mediaVersions);
    await expect(
      restoreMediaVersion(testDb(), { mediaId: 'other', versionId: version!.id, actor, origin })
    ).rejects.toBeInstanceOf(UploadError);
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
  it('refuses a file that is neither an image nor a supported document', async () => {
    const page = new File(['<html>'], 'page.html', { type: 'text/html' });
    await expect(storeUpload(form(page))).rejects.toThrow('Only JPEG, PNG, WebP, AVIF and GIF');
  });

  it('stores a PDF as a document with no dimensions or smaller copies', async () => {
    const pdf = new File(['%PDF-1.7\n'], 'brochure.pdf', { type: 'application/pdf' });
    const stored = await storeUpload(form(pdf));
    expect(stored).toMatchObject({
      mime: 'application/pdf',
      filename: 'brochure.pdf',
      width: null,
      height: null,
      variants: null,
    });
    expect(stored.r2Key).toMatch(/^media\/[\w-]+\.pdf$/);
    expect(await env.MEDIA.head(stored.r2Key)).not.toBeNull();
  });

  /** Just enough of a JPEG for imageSize: the markers and a baseline frame header. */
  function jpeg(width: number, height: number, type = 'image/jpeg') {
    const bytes = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      height >> 8,
      height & 255,
      width >> 8,
      width & 255,
      0x03,
      0x01,
      0x22,
      0x00,
      0x02,
      0x11,
      0x01,
      0x03,
      0x11,
      0x01,
      0xff,
      0xd9,
    ]);
    return new File([bytes], 'cover.jpg', { type });
  }
  const pdfWith = (cover?: File) => {
    const f = form(new File(['%PDF-1.7\n'], 'brochure.pdf', { type: 'application/pdf' }));
    if (cover) f.set('cover', cover);
    return f;
  };

  it('keeps a PDF first-page cover as its one smaller copy', async () => {
    const stored = await storeUpload(pdfWith(jpeg(640, 905)));
    expect(stored.variants).toEqual([
      { width: 640, key: expect.stringMatching(/^media\/[\w-]+-cover\.jpg$/), mime: 'image/jpeg' },
    ]);
    expect(stored.keys).toHaveLength(2);
    expect(await env.MEDIA.head(stored.variants![0]!.key)).not.toBeNull();
  });

  it('ignores a cover that is not a small JPEG, and still stores the PDF', async () => {
    for (const cover of [
      jpeg(640, 905, 'image/png'),
      new File([new Uint8Array(1024 * 1024 + 1)], 'cover.jpg', { type: 'image/jpeg' }),
      new File(['<html>'], 'cover.jpg', { type: 'image/jpeg' }),
      jpeg(5000, 5000),
    ]) {
      const stored = await storeUpload(pdfWith(cover));
      expect(stored.variants).toBeNull();
      expect(stored.keys).toHaveLength(1);
    }
  });

  it('takes no cover for an Office file', async () => {
    const f = form(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])], 'plan.docx'));
    f.set('cover', jpeg(640, 905));
    expect((await storeUpload(f)).variants).toBeNull();
  });

  it('takes a Word file the browser sent without a type', async () => {
    const docx = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])], 'plan.docx');
    const stored = await storeUpload(form(docx));
    expect(stored.mime).toContain('wordprocessingml');
    expect(stored.r2Key.endsWith('.docx')).toBe(true);
  });

  it('refuses a document whose contents are not that format', async () => {
    const fake = new File(['<script>alert(1)</script>'], 'evil.pdf', { type: 'application/pdf' });
    await expect(storeUpload(form(fake))).rejects.toThrow('not a real PDF');
  });

  it('refuses a document over the size limit', async () => {
    const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    await expect(storeUpload(form(big))).rejects.toThrow('larger than 20 MB');
  });

  it('will not swap an image for a document', async () => {
    const stored = await storeUpload(form(png(10, 10, 'a.png')));
    const [row] = await testDb().insert(media).values(stored).returning();
    const pdf = new File(['%PDF-1.7\n'], 'brochure.pdf', { type: 'application/pdf' });
    const next = await storeUpload(form(pdf));
    await expect(
      replaceMediaFile(testDb(), {
        id: row!.id,
        stored: next,
        actor: { id: await addUser('editor'), name: 'Sam' },
        origin,
      })
    ).rejects.toThrow('only be replaced with another image');
    expect(await env.MEDIA.head(next.r2Key)).toBeNull();
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

describe('attachPdfCover', () => {
  const jpeg = (width = 640, height = 905, type = 'image/jpeg') =>
    new File(
      [
        new Uint8Array([
          0xff,
          0xd8,
          0xff,
          0xc0,
          0x00,
          0x11,
          0x08,
          height >> 8,
          height & 255,
          width >> 8,
          width & 255,
          0x03,
          0x01,
          0x22,
          0x00,
          0x02,
          0x11,
          0x01,
          0x03,
          0x11,
          0x01,
          0xff,
          0xd9,
        ]),
      ],
      'cover.jpg',
      { type }
    );
  const origin = 'http://cms.test';

  beforeEach(async () => {
    await testDb().delete(media);
    vi.stubGlobal('caches', { default: { delete: vi.fn(async () => true) } });
  });

  async function addPdf() {
    const f = new FormData();
    f.set('file', new File(['%PDF-1.7\n'], 'old.pdf', { type: 'application/pdf' }));
    const stored = await storeUpload(f);
    const [row] = await testDb().insert(media).values(stored).returning();
    return row!;
  }
  const reload = async (id: string) =>
    (await testDb().select().from(media).where(eq(media.id, id)))[0]!;

  it('gives an older PDF its first-page thumbnail, beside the PDF', async () => {
    const row = await addPdf();
    expect(row.variants).toBeNull();

    await attachPdfCover(testDb(), { id: row.id, cover: jpeg(), origin });

    const after = await reload(row.id);
    expect(after.variants).toEqual([
      { width: 640, key: row.r2Key.replace(/\.pdf$/, '-cover.jpg'), mime: 'image/jpeg' },
    ]);
    expect(await env.MEDIA.head(after.variants![0]!.key)).not.toBeNull();
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(row.updatedAt.getTime());
  });

  it('replaces an existing thumbnail rather than adding a second', async () => {
    const row = await addPdf();
    await attachPdfCover(testDb(), { id: row.id, cover: jpeg(640, 905), origin });
    await attachPdfCover(testDb(), { id: row.id, cover: jpeg(640, 800), origin });
    expect((await reload(row.id)).variants).toHaveLength(1);
  });

  it('refuses a missing file, a file that is not a PDF and a thumbnail that is not usable', async () => {
    await expect(
      attachPdfCover(testDb(), { id: 'gone', cover: jpeg(), origin })
    ).rejects.toBeInstanceOf(UploadError);

    const [image] = await testDb()
      .insert(media)
      .values({ r2Key: 'media/x.png', filename: 'x.png', mime: 'image/png', size: 1 })
      .returning();
    await expect(
      attachPdfCover(testDb(), { id: image!.id, cover: jpeg(), origin })
    ).rejects.toThrow('Only a PDF');

    const row = await addPdf();
    for (const cover of [
      null,
      'cover',
      jpeg(640, 905, 'image/png'),
      new File(['<html>'], 'cover.jpg', { type: 'image/jpeg' }),
      jpeg(5000, 5000),
    ]) {
      await expect(attachPdfCover(testDb(), { id: row.id, cover, origin })).rejects.toThrow(
        'could not be used'
      );
    }
    expect((await reload(row.id)).variants).toBeNull();
  });
});

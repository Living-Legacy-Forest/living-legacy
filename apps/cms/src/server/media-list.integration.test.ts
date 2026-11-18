import { media } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { listMediaExtensions, listMediaPage, listMediaSchema, listMediaTags } from './media-list';

beforeEach(async () => {
  await testDb().delete(media);
});

let n = 0;
async function addFile(
  filename: string,
  extra: Partial<typeof media.$inferInsert> & { at?: number } = {}
) {
  const { at, ...rest } = extra;
  const [row] = await testDb()
    .insert(media)
    .values({
      r2Key: `media/${++n}.jpg`,
      filename,
      mime: 'image/jpeg',
      size: 1000,
      createdAt: new Date(at ?? n * 1000),
      ...rest,
    })
    .returning();
  return row!;
}

const page = (input: Partial<ReturnType<typeof listMediaSchema.parse>> = {}) =>
  listMediaPage(testDb(), listMediaSchema.parse(input));

describe('listMediaPage', () => {
  it('pages newest first without repeating or skipping, even with equal times', async () => {
    // Five files, three uploaded in the same millisecond.
    for (const [name, at] of [
      ['a', 1000],
      ['b', 2000],
      ['c', 3000],
      ['d', 3000],
      ['e', 3000],
    ] as const) {
      await addFile(name, { at });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const result = await page({ limit: 2, cursor });
      expect(result.total).toBe(5);
      seen.push(...result.items.map((m) => m.filename));
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(seen.slice(3)).toEqual(['b', 'a']);
  });

  it('says when there is nothing more', async () => {
    await addFile('only.jpg');
    const result = await page({ limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('searches every word across name, alt text and caption, in any case', async () => {
    await addFile('IMG_0042.jpg', { alt: 'Planting day at the forest' });
    await addFile('family.jpg', { caption: 'A quiet morning planting' });
    await addFile('logo.png', { mime: 'image/png' });

    const planting = await page({ q: 'PLANTING' });
    expect(planting.items.map((m) => m.filename).sort()).toEqual(['IMG_0042.jpg', 'family.jpg']);
    expect(planting.total).toBe(2);

    const both = await page({ q: 'planting forest' });
    expect(both.items.map((m) => m.filename)).toEqual(['IMG_0042.jpg']);
  });

  it('treats % and _ in a search as plain characters', async () => {
    await addFile('100%_done.jpg');
    await addFile('100x.jpg');
    expect((await page({ q: '100%' })).items.map((m) => m.filename)).toEqual(['100%_done.jpg']);
    expect((await page({ q: '_' })).items.map((m) => m.filename)).toEqual(['100%_done.jpg']);
  });

  it('leaves out documents for an image field', async () => {
    await addFile('brochure.pdf', { mime: 'application/pdf' });
    await addFile('photo.jpg');
    const result = await page({ imagesOnly: true });
    expect(result.items.map((m) => m.filename)).toEqual(['photo.jpg']);
    expect(result.total).toBe(1);
  });

  it('filters the library to images or to documents, with a count for each', async () => {
    await addFile('photo.jpg');
    await addFile('brochure.pdf', {
      mime: 'application/pdf',
      variants: [{ width: 640, key: 'k', mime: 'image/jpeg' }],
    });
    await addFile('plan.docx', {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const images = await page({ kinds: ['image'] });
    expect(images.items.map((m) => m.filename)).toEqual(['photo.jpg']);
    expect(images.total).toBe(1);

    const documents = await page({ kinds: ['document'] });
    expect(documents.items.map((m) => m.filename).sort()).toEqual(['brochure.pdf', 'plan.docx']);
    expect(documents.total).toBe(2);

    // Both kinds is the same as neither.
    expect((await page({ kinds: ['image', 'document'] })).total).toBe(3);
    expect((await page()).total).toBe(3);
  });

  it('says which documents have a first-page thumbnail', async () => {
    await addFile('brochure.pdf', {
      mime: 'application/pdf',
      variants: [{ width: 640, key: 'k', mime: 'image/jpeg' }],
    });
    await addFile('old.pdf', { mime: 'application/pdf' });
    await addFile('photo.jpg', { variants: [{ width: 320, key: 'j', mime: 'image/jpeg' }] });
    const byName = Object.fromEntries((await page()).items.map((m) => [m.filename, m.hasCover]));
    expect(byName).toEqual({ 'brochure.pdf': true, 'old.pdf': false, 'photo.jpg': false });
  });

  it('filters by tag, finds tags in search, and counts them', async () => {
    await addFile('a.jpg', { tags: ['spring', 'forest'] });
    await addFile('b.jpg', { tags: ['spring'] });
    await addFile('c.jpg');
    expect((await page({ tags: ['spring'] })).items.map((m) => m.filename).sort()).toEqual([
      'a.jpg',
      'b.jpg',
    ]);
    expect((await page({ tags: ['forest'] })).total).toBe(1);
    expect((await page({ tags: ['nothing'] })).total).toBe(0);
    // Several tags match a file that has any of them.
    expect((await page({ tags: ['forest', 'nothing'] })).total).toBe(1);
    expect((await page({ tags: ['forest', 'spring'] })).total).toBe(2);
    expect((await page({ q: 'forest' })).items.map((m) => m.filename)).toEqual(['a.jpg']);
    expect(await listMediaTags(testDb())).toEqual([
      { tag: 'spring', count: 2 },
      { tag: 'forest', count: 1 },
    ]);
  });

  it('filters by one or several extensions and combines with the other filters', async () => {
    await addFile('photo.jpg');
    await addFile('Shot.JPEG');
    await addFile('logo.png', { mime: 'image/png' });
    await addFile('brochure.pdf', { mime: 'application/pdf', tags: ['print'] });
    await addFile('plan.docx', {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      tags: ['print'],
    });
    await addFile('archive.v2.final.pdf', { mime: 'application/pdf' });
    await addFile('noextension');

    const names = async (input: object) => (await page(input)).items.map((m) => m.filename).sort();
    expect(await names({ exts: ['pdf'] })).toEqual(['archive.v2.final.pdf', 'brochure.pdf']);
    expect(await names({ exts: ['jpg', 'jpeg'] })).toEqual(['Shot.JPEG', 'photo.jpg']);
    expect(await names({ exts: ['pdf', 'docx'] })).toHaveLength(3);
    expect(await names({ exts: ['pdf'], tags: ['print'] })).toEqual(['brochure.pdf']);
    expect(await names({ exts: ['pdf'], kinds: ['image'] })).toEqual([]);
    expect((await page({ exts: ['pdf'] })).total).toBe(2);

    expect(await listMediaExtensions(testDb())).toEqual([
      { ext: 'pdf', count: 2 },
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
    ]);
  });

  it('refuses an extension that is not plain letters and digits', () => {
    expect(listMediaSchema.safeParse({ exts: ['pdf'] }).success).toBe(true);
    expect(listMediaSchema.safeParse({ exts: ["pdf' or '1'='1"] }).success).toBe(false);
    expect(listMediaSchema.safeParse({ exts: ['.pdf'] }).success).toBe(false);
  });

  it('puts the library in the chosen order, ties broken the same way every time', async () => {
    await addFile('banana.jpg', { size: 300, at: 1000 });
    await addFile('Apple.jpg', { size: 100, at: 2000 });
    await addFile('cherry.jpg', { size: 200, at: 3000 });
    await addFile('cherry.jpg', { size: 200, at: 3000 });
    const names = async (sort: string) =>
      (await page({ sort } as never)).items.map((m) => m.filename);

    expect(await names('newest')).toEqual(['cherry.jpg', 'cherry.jpg', 'Apple.jpg', 'banana.jpg']);
    expect(await names('oldest')).toEqual(['banana.jpg', 'Apple.jpg', 'cherry.jpg', 'cherry.jpg']);
    // Names ignore case.
    expect(await names('name-az')).toEqual(['Apple.jpg', 'banana.jpg', 'cherry.jpg', 'cherry.jpg']);
    expect(await names('name-za')).toEqual(['cherry.jpg', 'cherry.jpg', 'banana.jpg', 'Apple.jpg']);
    expect((await names('largest'))[0]).toBe('banana.jpg');
    expect((await names('smallest'))[0]).toBe('Apple.jpg');
    // Something that is not an order falls back to newest.
    expect(await names('nonsense')).toEqual(await names('newest'));

    // Pages of an order do not repeat or skip, even through equal values.
    const first = await page({ sort: 'name-az', limit: 2 } as never);
    const more = await page({ sort: 'name-az', limit: 4 } as never);
    expect(more.items.slice(0, 2).map((m) => m.id)).toEqual(first.items.map((m) => m.id));
  });

  it('gives a focal point only when both coordinates are set', async () => {
    await addFile('both.jpg', { focalX: 0.25, focalY: 0.75 });
    await addFile('half.jpg', { focalX: 0.5 });
    await addFile('none.jpg');
    const byName = Object.fromEntries((await page()).items.map((m) => [m.filename, m.focal]));
    expect(byName).toEqual({
      'both.jpg': { x: 0.25, y: 0.75 },
      'half.jpg': null,
      'none.jpg': null,
    });
  });

  it('returns a linked file that is not on the page', async () => {
    const old = await addFile('old.jpg');
    await addFile('new.jpg');
    const result = await page({ limit: 1, include: old.id });
    expect(result.items.map((m) => m.filename)).toEqual(['new.jpg']);
    expect(result.included?.id).toBe(old.id);

    const onPage = await page({ include: old.id });
    expect(onPage.included).toBeNull();
  });
});

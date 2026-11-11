import { media } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { listMediaPage, listMediaSchema } from './media-list';

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

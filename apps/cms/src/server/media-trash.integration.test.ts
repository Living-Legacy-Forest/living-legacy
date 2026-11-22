// The media trash against local D1 and R2: what moving, restoring and deleting do to the rows,
// the stored objects, the library, the public address and the activity log.
import { MEDIA_TRASH_DAYS } from '@ll/content';
import { activityLog, media, mediaVersions } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, days, testDb } from '../../test/fixtures';
import { serveMedia } from './media-delivery';
import { listMediaExtensions, listMediaPage, listMediaTags } from './media-list';
import { sweepOrphanedMedia } from './media-sweep';
import { deleteTrashedMedia, purgeTrashedMedia, trashMedia, untrashMedia } from './media-trash';

const origin = 'http://cms.test';
let actor = { id: '', name: 'Sam Tester' };

beforeEach(async () => {
  const db = testDb();
  await db.delete(mediaVersions);
  await db.delete(media);
  await db.delete(activityLog);
  const listed = await env.MEDIA.list();
  if (listed.objects.length) await env.MEDIA.delete(listed.objects.map((o) => o.key));
  actor = { id: await addUser('admin'), name: 'Sam Tester' };
  // The edge cache only exists on Workers: nothing is ever cached here.
  vi.stubGlobal('caches', {
    default: { match: async () => undefined, put: async () => {}, delete: async () => true },
  });
});

/** A stored file and its row. */
async function addFile(
  name: string,
  values: Partial<typeof media.$inferInsert> = {}
): Promise<typeof media.$inferSelect> {
  const r2Key = `media/${crypto.randomUUID()}.png`;
  await env.MEDIA.put(r2Key, new Uint8Array([1, 2, 3]));
  const [row] = await testDb()
    .insert(media)
    .values({ r2Key, filename: name, mime: 'image/png', size: 3, ...values })
    .returning();
  return row!;
}

const rowOf = (id: string) => testDb().query.media.findFirst({ where: eq(media.id, id) });
const actions = async () =>
  (await testDb().select().from(activityLog)).map((e) => [e.action, e.actorName, e.summary]);
const serve = (id: string) =>
  serveMedia(new Request(`${origin}/api/media/${id}`), id, {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext);

describe('moving to the trash', () => {
  it('hides the file but keeps what is stored, and says who did it', async () => {
    const file = await addFile('tree.png');
    expect(await trashMedia(testDb(), { ids: [file.id], actor, origin })).toBe(1);

    const row = await rowOf(file.id);
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(row?.deletedBy).toBe(actor.id);
    expect(await env.MEDIA.head(file.r2Key)).not.toBeNull();
    expect(await actions()).toEqual([
      ['media.trashed', 'Sam Tester', 'Moved tree.png to the trash'],
    ]);
  });

  it('leaves a file already in the trash as it was', async () => {
    const file = await addFile('tree.png');
    await trashMedia(testDb(), { ids: [file.id], actor, origin });
    const first = (await rowOf(file.id))!.deletedAt;

    expect(await trashMedia(testDb(), { ids: [file.id], actor, origin })).toBe(0);
    expect((await rowOf(file.id))!.deletedAt).toEqual(first);
    expect(await actions()).toHaveLength(1);
  });

  it('names how many when several move together', async () => {
    const [a, b] = [await addFile('a.png'), await addFile('b.png')];
    await trashMedia(testDb(), { ids: [a.id, b.id], actor, origin });
    expect((await actions())[0]?.[2]).toBe('Moved 2 files to the trash');
  });
});

describe('the library and the trash', () => {
  it('lists trashed files only in the trash, and counts them for the library', async () => {
    const kept = await addFile('kept.png', { tags: ['forest'] });
    const binned = await addFile('binned.jpg', { tags: ['old'] });
    await trashMedia(testDb(), { ids: [binned.id], actor, origin });

    const library = await listMediaPage(testDb(), { limit: 50 });
    expect(library.items.map((i) => i.id)).toEqual([kept.id]);
    expect(library.total).toBe(1);
    expect(library.trashTotal).toBe(1);

    const trash = await listMediaPage(testDb(), { limit: 50, trash: true });
    expect(trash.items.map((i) => i.id)).toEqual([binned.id]);
    expect(trash.items[0]?.trashedAt).toEqual(expect.any(Number));
    // Its previews come from the signed-in route, since the public address is closed.
    expect(trash.items[0]?.url).toBe(`/api/media-trash/${binned.id}`);
  });

  it('leaves trashed files out of the tag and format filters', async () => {
    await addFile('kept.png', { tags: ['forest'] });
    const binned = await addFile('binned.jpg', { tags: ['old'] });
    await trashMedia(testDb(), { ids: [binned.id], actor, origin });

    expect((await listMediaTags(testDb())).map((t) => t.tag)).toEqual(['forest']);
    expect((await listMediaExtensions(testDb())).map((e) => e.ext)).toEqual(['png']);
  });

  it('does not return a trashed file asked for by id in the library', async () => {
    const binned = await addFile('binned.png');
    await trashMedia(testDb(), { ids: [binned.id], actor, origin });
    const page = await listMediaPage(testDb(), { limit: 50, include: binned.id });
    expect(page.included).toBeNull();
  });
});

describe('the public address', () => {
  it('answers 404 while the file is in the trash, and works again once restored', async () => {
    const file = await addFile('tree.png');
    expect((await serve(file.id)).status).toBe(200);

    await trashMedia(testDb(), { ids: [file.id], actor, origin });
    expect((await serve(file.id)).status).toBe(404);

    expect(await untrashMedia(testDb(), { ids: [file.id], actor })).toBe(1);
    expect((await serve(file.id)).status).toBe(200);
  });
});

describe('restoring', () => {
  it('puts the file back in the library and logs it', async () => {
    const file = await addFile('tree.png');
    await trashMedia(testDb(), { ids: [file.id], actor, origin });
    await untrashMedia(testDb(), { ids: [file.id], actor });

    const row = await rowOf(file.id);
    expect(row?.deletedAt).toBeNull();
    expect(row?.deletedBy).toBeNull();
    expect((await actions()).map((a) => a[0])).toEqual(['media.trashed', 'media.untrashed']);
  });

  it('does nothing to a file that is not in the trash', async () => {
    const file = await addFile('tree.png');
    expect(await untrashMedia(testDb(), { ids: [file.id], actor })).toBe(0);
    expect(await actions()).toEqual([]);
  });
});

describe('deleting for good', () => {
  it('removes a trashed file, its stored objects and its earlier versions', async () => {
    const file = await addFile('tree.png');
    const oldKey = `media/${crypto.randomUUID()}.png`;
    await env.MEDIA.put(oldKey, new Uint8Array([4]));
    await testDb()
      .insert(mediaVersions)
      .values({ mediaId: file.id, r2Key: oldKey, filename: 'old.png', mime: 'image/png', size: 1 });
    await trashMedia(testDb(), { ids: [file.id], actor, origin });

    const result = await deleteTrashedMedia(testDb(), { ids: [file.id], actor, origin });

    expect(result).toEqual({ removed: 1, failed: 0 });
    expect(await rowOf(file.id)).toBeUndefined();
    expect(await testDb().select().from(mediaVersions)).toEqual([]);
    expect(await env.MEDIA.head(file.r2Key)).toBeNull();
    expect(await env.MEDIA.head(oldKey)).toBeNull();
    expect((await actions()).at(-1)).toEqual([
      'media.deleted',
      'Sam Tester',
      'Deleted tree.png for good',
    ]);
  });

  it('refuses a file that is not in the trash', async () => {
    const file = await addFile('tree.png');
    expect(await deleteTrashedMedia(testDb(), { ids: [file.id], actor, origin })).toEqual({
      removed: 0,
      failed: 0,
    });
    expect(await rowOf(file.id)).toBeDefined();
    expect(await env.MEDIA.head(file.r2Key)).not.toBeNull();
  });
});

describe('the daily purge', () => {
  const now = new Date();
  const trashedAgo = async (name: string, ms: number) => {
    const file = await addFile(name, {
      deletedAt: new Date(now.getTime() - ms),
      deletedBy: actor.id,
    });
    return file;
  };

  it('deletes only files in the trash past their time', async () => {
    const old = await trashedAgo('old.png', days(MEDIA_TRASH_DAYS + 1));
    const recent = await trashedAgo('recent.png', days(MEDIA_TRASH_DAYS - 1));
    const kept = await addFile('kept.png');

    expect(await purgeTrashedMedia(env.DB, now, origin)).toEqual({ removed: 1, failed: 0 });

    expect(await rowOf(old.id)).toBeUndefined();
    expect(await env.MEDIA.head(old.r2Key)).toBeNull();
    expect(await rowOf(recent.id)).toBeDefined();
    expect(await rowOf(kept.id)).toBeDefined();
    expect((await actions()).at(-1)).toEqual([
      'media.deleted',
      'Scheduled',
      'Deleted old.png for good after their time in the trash',
    ]);
  });

  it('works through more files than one query can name', async () => {
    for (let i = 0; i < 60; i++) await trashedAgo(`old-${i}.png`, days(MEDIA_TRASH_DAYS + 2));
    expect(await purgeTrashedMedia(env.DB, now, origin)).toEqual({ removed: 60, failed: 0 });
    expect(await testDb().select().from(media)).toEqual([]);
  });

  it('does nothing when nothing is due', async () => {
    await addFile('kept.png');
    expect(await purgeTrashedMedia(env.DB, now, origin)).toEqual({ removed: 0, failed: 0 });
    expect(await actions()).toEqual([]);
  });
});

describe('the unused-files sweep', () => {
  it('keeps the stored objects of a file in the trash', async () => {
    const file = await addFile('tree.png');
    await trashMedia(testDb(), { ids: [file.id], actor, origin });
    // Past the sweep's grace for files still uploading.
    await sweepOrphanedMedia(env.DB, env.MEDIA, new Date(Date.now() + days(2)));
    expect(await env.MEDIA.head(file.r2Key)).not.toBeNull();
  });
});

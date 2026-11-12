import { emptyPostInput } from '@ll/content';
import { postPresence, posts } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { createDraft } from './post-store';
import { PRESENCE_TIMEOUT_MS, checkIn, checkOut } from './post-presence-store';

beforeEach(async () => {
  await testDb().delete(postPresence);
  await testDb().delete(posts);
});

async function setup() {
  const sam = await addUser('editor', 'Sam Tester');
  const alex = await addUser('editor', 'Alex Rivers');
  const post = await createDraft(testDb(), { ...emptyPostInput, title: 'Planting day' }, sam);
  return { sam, alex, postId: post.id, loadedAt: post.updatedAt.getTime() };
}

describe('checkIn', () => {
  it('shows each person the others with the post open, not themselves', async () => {
    const { sam, alex, postId } = await setup();
    const now = new Date();
    expect((await checkIn(testDb(), postId, sam, null, now)).others).toEqual([]);

    const forAlex = await checkIn(testDb(), postId, alex, null, now);
    expect(forAlex.others.map((o) => o.name)).toEqual(['Sam Tester']);
    const forSam = await checkIn(testDb(), postId, sam, null, now);
    expect(forSam.others.map((o) => o.name)).toEqual(['Alex Rivers']);
  });

  it('drops someone not heard from for a minute, and at once when they close it', async () => {
    const { sam, alex, postId } = await setup();
    const then = new Date('2027-03-10T00:00:00Z');
    await checkIn(testDb(), postId, alex, null, then);

    const later = new Date(then.getTime() + PRESENCE_TIMEOUT_MS + 1000);
    expect((await checkIn(testDb(), postId, sam, null, later)).others).toEqual([]);

    await checkIn(testDb(), postId, alex, null, later);
    await checkOut(testDb(), postId, alex);
    expect((await checkIn(testDb(), postId, sam, null, later)).others).toEqual([]);
  });

  it('says when someone else saved after this editor loaded the post, but not for own saves', async () => {
    const { sam, alex, postId, loadedAt } = await setup();
    expect((await checkIn(testDb(), postId, alex, loadedAt)).newerSave).toBeNull();

    const savedAt = new Date(loadedAt + 5000);
    await testDb()
      .update(posts)
      .set({ title: 'Planting day, updated', updatedAt: savedAt, updatedBy: sam })
      .where(eq(posts.id, postId));

    expect((await checkIn(testDb(), postId, alex, loadedAt)).newerSave).toEqual({
      name: 'Sam Tester',
      at: savedAt.getTime(),
    });
    // Sam made that save, so Sam is not told about it.
    expect((await checkIn(testDb(), postId, sam, loadedAt)).newerSave).toBeNull();
    // Once Alex reloads, the save is no longer newer.
    expect((await checkIn(testDb(), postId, alex, savedAt.getTime())).newerSave).toBeNull();
  });
});

import { emptyPostInput } from '@ll/content';
import { posts } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { createDraft, liveInput, saveEdits } from './post-store';

beforeEach(async () => {
  await testDb().delete(posts);
});

describe('focus keyword and related terms', () => {
  it('are saved with a new post and read back', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const row = await createDraft(
      db,
      {
        ...emptyPostInput,
        title: 'Planting day',
        focusKeyword: 'planting day',
        relatedTerms: ['family', 'ceremony'],
      },
      userId
    );
    const input = await liveInput(db, row);
    expect(input.focusKeyword).toBe('planting day');
    expect(input.relatedTerms).toEqual(['family', 'ceremony']);
  });

  it('wait in the draft of a published post until it is published again', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const [row] = await db
      .insert(posts)
      .values({ title: 'Live', slug: 'live', status: 'published' })
      .returning();
    await saveEdits(
      db,
      row!,
      { ...(await liveInput(db, row!)), focusKeyword: 'new phrase' },
      userId
    );
    const after = await db.query.posts.findFirst({ where: eq(posts.id, row!.id) });
    expect(after!.focusKeyword).toBeNull();
    expect((after!.draft as { focusKeyword: string }).focusKeyword).toBe('new phrase');
  });

  it('read as empty on a post saved before they existed', async () => {
    const db = testDb();
    const [row] = await db.insert(posts).values({ title: 'Old', slug: 'old' }).returning();
    const input = await liveInput(db, row!);
    expect(input.focusKeyword).toBe('');
    expect(input.relatedTerms).toEqual([]);
  });
});

import { emptyPostInput } from '@ll/content';
import { locations, posts } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { createDraft, liveInput, saveEdits } from './post-store';

beforeEach(async () => {
  await testDb().delete(posts);
  await testDb().delete(locations);
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

describe('search and sharing fields', () => {
  it('are saved with a new post and read back, with empty text stored as null', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const row = await createDraft(
      db,
      {
        ...emptyPostInput,
        title: 'Planting day',
        canonicalUrl: 'https://example.com.au/stories/planting-day/',
        socialTitle: 'Come plant with us',
        nofollow: true,
        noimageindex: true,
      },
      userId
    );
    const stored = await db.query.posts.findFirst({ where: eq(posts.id, row.id) });
    expect(stored).toMatchObject({
      canonicalUrl: 'https://example.com.au/stories/planting-day/',
      socialTitle: 'Come plant with us',
      socialDescription: null,
      nofollow: true,
      nosnippet: false,
      noimageindex: true,
    });
    expect(await liveInput(db, stored!)).toMatchObject({
      canonicalUrl: 'https://example.com.au/stories/planting-day/',
      socialTitle: 'Come plant with us',
      socialDescription: '',
      nofollow: true,
      nosnippet: false,
      noimageindex: true,
    });
  });
});

describe('location', () => {
  const addLocation = async (values: Partial<typeof locations.$inferInsert> = {}) => {
    const [row] = await testDb()
      .insert(locations)
      .values({ name: 'Living Legacy Mornington', slug: 'mornington', state: 'VIC', ...values })
      .returning();
    return row!;
  };

  it('is saved with a post and read back', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const place = await addLocation();
    const row = await createDraft(
      db,
      { ...emptyPostInput, title: 'Open day', locationId: place.id },
      userId
    );
    expect((await liveInput(db, row)).locationId).toBe(place.id);
  });

  it('is dropped when the location is in the trash or does not exist', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const trashed = await addLocation({ slug: 'old', deletedAt: new Date() });
    const one = await createDraft(
      db,
      { ...emptyPostInput, title: 'A', locationId: trashed.id },
      userId
    );
    const two = await createDraft(
      db,
      { ...emptyPostInput, title: 'B', locationId: 'nope' },
      userId
    );
    expect((await liveInput(db, one)).locationId).toBeNull();
    expect((await liveInput(db, two)).locationId).toBeNull();
  });

  it('clears from posts when the location is deleted for good', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const place = await addLocation();
    const row = await createDraft(
      db,
      { ...emptyPostInput, title: 'Open day', locationId: place.id },
      userId
    );
    await db.delete(locations).where(eq(locations.id, place.id));
    const after = await db.query.posts.findFirst({ where: eq(posts.id, row.id) });
    expect(after!.locationId).toBeNull();
  });
});

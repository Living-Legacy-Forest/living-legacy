import {
  SITE_SETTINGS_DEFAULTS,
  analysePost,
  contentTargetsFrom,
  emptyPostInput,
  guidelinesFromSettings,
} from '@ll/content';
import { posts, siteSettings } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { createDraft, liveInput, publishValues } from './post-store';
import { loadScoreSummary, rescorePosts } from './post-score';

const body = {
  type: 'doc' as const,
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Trees grow slowly. Families visit.' }] },
  ],
};
const input = {
  ...emptyPostInput,
  title: 'Visiting the forest through the seasons',
  focusKeyword: 'forest',
  body,
};
const expected = (slug: string) => {
  const values = { ...input, slug };
  return analysePost(
    values,
    guidelinesFromSettings(contentTargetsFrom(SITE_SETTINGS_DEFAULTS), values)
  ).score;
};
const find = async (id: string) =>
  (await testDb().query.posts.findFirst({ where: eq(posts.id, id) }))!;

beforeEach(async () => {
  await testDb().delete(posts);
  await testDb().delete(siteSettings);
});

describe('content score on save', () => {
  it('is stored when a draft is created, using the derived permalink', async () => {
    const userId = await addUser('editor');
    const row = await createDraft(testDb(), input, userId);
    expect((await find(row.id)).contentScore).toBe(
      expected('visiting-the-forest-through-the-seasons')
    );
  });

  it('is stored when a post is published', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const row = await createDraft(db, input, userId);
    await db.update(posts).set({ contentScore: null }).where(eq(posts.id, row.id));
    const fresh = await find(row.id);
    await publishValues(db, fresh, await liveInput(db, fresh), userId, 'Robin');
    expect((await find(row.id)).contentScore).toBe(expected(fresh.slug));
  });

  it('follows the targets saved in Settings', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    await db
      .insert(siteSettings)
      .values({ id: 'site', data: { ...SITE_SETTINGS_DEFAULTS, targetWordsMin: 1 } });
    const row = await createDraft(db, input, userId);
    expect((await find(row.id)).contentScore).toBeGreaterThan(
      expected('visiting-the-forest-through-the-seasons')
    );
  });
});

describe('rescorePosts', () => {
  it('scores posts with no score and leaves the trash alone', async () => {
    const db = testDb();
    const [live, trashed] = await db
      .insert(posts)
      .values([
        { title: 'Live', slug: 'live', status: 'published' },
        { title: 'Binned', slug: 'binned', deletedAt: new Date() },
      ])
      .returning();
    const result = await rescorePosts(env.DB);
    expect(result).toEqual({ rescored: 1 });
    expect((await find(live!.id)).contentScore).toEqual(expect.any(Number));
    expect((await find(trashed!.id)).contentScore).toBeNull();
  });

  it('only writes scores that changed', async () => {
    await rescorePosts(env.DB);
    const db = testDb();
    await db.insert(posts).values({ title: 'Live', slug: 'live', status: 'published' });
    expect(await rescorePosts(env.DB)).toEqual({ rescored: 1 });
    expect(await rescorePosts(env.DB)).toEqual({ rescored: 0 });
  });
});

describe('loadScoreSummary', () => {
  it('counts bands, averages and lists the lowest published posts', async () => {
    const db = testDb();
    const published = { status: 'published' as const };
    await db.insert(posts).values([
      { title: 'A', slug: 'a', contentScore: 30, ...published },
      { title: 'B', slug: 'b', contentScore: 49, ...published },
      { title: 'C', slug: 'c', contentScore: 50, ...published },
      { title: 'D', slug: 'd', contentScore: 80, ...published },
      { title: 'E', slug: 'e', contentScore: null, ...published },
      { title: 'Draft', slug: 'draft', contentScore: 5 },
      { title: 'Binned', slug: 'binned', contentScore: 1, deletedAt: new Date(), ...published },
    ]);
    const summary = await loadScoreSummary(db);
    expect(summary.bands).toEqual({ low: 2, mid: 1, high: 1 });
    expect(summary.scored).toBe(4);
    expect(summary.unscored).toBe(1);
    expect(summary.average).toBe(52); // (30 + 49 + 50 + 80) / 4 = 52.25
    expect(summary.lowest.map((p) => [p.title, p.score])).toEqual([
      ['A', 30],
      ['B', 49],
      ['C', 50],
      ['D', 80],
    ]);
  });

  it('is empty when nothing is published', async () => {
    const summary = await loadScoreSummary(testDb());
    expect(summary).toEqual({
      bands: { low: 0, mid: 0, high: 0 },
      scored: 0,
      unscored: 0,
      average: null,
      lowest: [],
    });
  });
});

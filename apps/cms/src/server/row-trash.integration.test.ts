// The trash for redirects, announcements, categories and tags against local D1: deleting moves
// the whole row aside, Undo puts it back as it was, and the daily job clears what has waited
// 30 days.
import { MEDIA_TRASH_DAYS } from '@ll/content';
import { announcements, postTerms, posts, redirects, terms, trashedRows } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, days, testDb } from '../../test/fixtures';
import { purgeTrashedContent } from './content-trash';
import { restoreWholeRows, trashWholeRows } from './row-trash';

let userId = '';

beforeEach(async () => {
  const db = testDb();
  await db.delete(trashedRows);
  await db.delete(postTerms);
  await db.delete(posts);
  await db.delete(terms);
  await db.delete(redirects);
  await db.delete(announcements);
  userId = await addUser('admin');
});

const addRedirect = async (fromPath: string, values: Partial<typeof redirects.$inferInsert> = {}) =>
  (
    await testDb()
      .insert(redirects)
      .values({ fromPath, toPath: '/new', ...values })
      .returning()
  )[0]!;

describe('redirects', () => {
  it('come back as they were, with their counts and dates', async () => {
    const lastHitAt = new Date('2027-01-05T10:00:00Z');
    const row = await addRedirect('/old', { hits: 42, lastHitAt, note: 'Moved in January' });

    await trashWholeRows(testDb(), 'redirects', { ids: [row.id], userId });
    expect(await testDb().select().from(redirects)).toHaveLength(0);

    const result = await restoreWholeRows(testDb(), 'redirects', { ids: [row.id] });
    expect(result).toEqual({ restored: 1, skipped: 0 });
    const [back] = await testDb().select().from(redirects);
    expect(back).toEqual(row);
    expect(back!.lastHitAt).toEqual(lastHitAt);
    expect(await testDb().select().from(trashedRows)).toHaveLength(0);
  });

  it('are left in the trash when their path is in use again, and the rest still come back', async () => {
    const [a, b] = [await addRedirect('/a'), await addRedirect('/b')];
    await trashWholeRows(testDb(), 'redirects', { ids: [a.id, b.id], userId });
    await addRedirect('/a');

    const result = await restoreWholeRows(testDb(), 'redirects', { ids: [a.id, b.id] });

    expect(result).toEqual({ restored: 1, skipped: 1 });
    const live = await testDb().select().from(redirects);
    expect(live.map((r) => r.fromPath).sort()).toEqual(['/a', '/b']);
    expect(live.find((r) => r.fromPath === '/a')!.id).not.toBe(a.id);
    const kept = await testDb().select().from(trashedRows);
    expect(kept.map((t) => t.rowId)).toEqual([a.id]);
  });

  it('counts an id with nothing in the trash as skipped', async () => {
    const result = await restoreWholeRows(testDb(), 'redirects', { ids: ['nothing-here'] });
    expect(result).toEqual({ restored: 0, skipped: 1 });
  });

  it('go and come back in a long list, past the 100 values a query allows', async () => {
    const ids: string[] = [];
    // A few at a time: the setup has the same limit as the code under test.
    for (let i = 0; i < 120; i += 5) {
      const rows = await testDb()
        .insert(redirects)
        .values(
          Array.from({ length: 5 }, (_, j) => ({ fromPath: `/old-${i + j}`, toPath: '/new' }))
        )
        .returning({ id: redirects.id });
      ids.push(...rows.map((r) => r.id));
    }

    const gone = await trashWholeRows(testDb(), 'redirects', { ids, userId });
    expect(gone).toHaveLength(120);
    expect(await testDb().select().from(redirects)).toHaveLength(0);

    const result = await restoreWholeRows(testDb(), 'redirects', { ids });
    expect(result).toEqual({ restored: 120, skipped: 0 });
    expect(await testDb().select().from(redirects)).toHaveLength(120);
  });

  it('keeps one trash entry when a row is deleted, put back and deleted again', async () => {
    const row = await addRedirect('/again');
    await trashWholeRows(testDb(), 'redirects', { ids: [row.id], userId });
    await restoreWholeRows(testDb(), 'redirects', { ids: [row.id] });
    await trashWholeRows(testDb(), 'redirects', { ids: [row.id], userId });
    expect(await testDb().select().from(trashedRows)).toHaveLength(1);
  });
});

describe('announcements', () => {
  it('come back as they were, with their dates and hidden paths', async () => {
    const [row] = await testDb()
      .insert(announcements)
      .values({
        title: 'November upgrade',
        message: 'Free tree upgrade',
        startsAt: new Date('2027-11-01T00:00:00Z'),
        hidePaths: ['/events/open-days'],
      })
      .returning();

    await trashWholeRows(testDb(), 'announcements', { ids: [row!.id], userId });
    await restoreWholeRows(testDb(), 'announcements', { ids: [row!.id] });

    const [back] = await testDb().select().from(announcements);
    expect(back).toEqual(row);
    expect(back!.hidePaths).toEqual(['/events/open-days']);
  });
});

describe('categories and tags', () => {
  async function addTerm(type: 'category' | 'tag', name: string) {
    return (
      await testDb().insert(terms).values({ type, name, slug: name.toLowerCase() }).returning()
    )[0]!;
  }
  const addPost = async (slug: string) =>
    (await testDb().insert(posts).values({ title: slug, slug }).returning())[0]!;

  it('come back on the posts they were on', async () => {
    const news = await addTerm('category', 'News');
    const [p1, p2] = [await addPost('one'), await addPost('two')];
    await testDb()
      .insert(postTerms)
      .values([
        { postId: p1.id, termId: news.id },
        { postId: p2.id, termId: news.id },
      ]);

    await trashWholeRows(testDb(), 'terms', { ids: [news.id], userId });
    expect(await testDb().select().from(postTerms)).toHaveLength(0);

    await restoreWholeRows(testDb(), 'terms', { ids: [news.id] });
    const links = await testDb().select().from(postTerms).where(eq(postTerms.termId, news.id));
    expect(links.map((l) => l.postId).sort()).toEqual([p1.id, p2.id].sort());
  });

  it('come back without a post that was deleted in the meantime', async () => {
    const news = await addTerm('category', 'News');
    const [kept, gone] = [await addPost('kept'), await addPost('gone')];
    await testDb()
      .insert(postTerms)
      .values([
        { postId: kept.id, termId: news.id },
        { postId: gone.id, termId: news.id },
      ]);
    await trashWholeRows(testDb(), 'terms', { ids: [news.id], userId });
    await testDb().delete(posts).where(eq(posts.id, gone.id));

    const result = await restoreWholeRows(testDb(), 'terms', { ids: [news.id] });

    expect(result.restored).toBe(1);
    const links = await testDb().select().from(postTerms);
    expect(links.map((l) => l.postId)).toEqual([kept.id]);
  });

  it('only delete the type asked for, when a category and a tag share an id', async () => {
    const tag = await addTerm('tag', 'Spring');
    const rows = await trashWholeRows(testDb(), 'terms', {
      ids: [tag.id],
      userId,
      also: eq(terms.type, 'category'),
    });
    expect(rows).toHaveLength(0);
    expect(await testDb().select().from(terms)).toHaveLength(1);
  });

  it('are left in the trash when the name has been used again', async () => {
    const news = await addTerm('category', 'News');
    await trashWholeRows(testDb(), 'terms', { ids: [news.id], userId });
    await addTerm('category', 'News');

    const result = await restoreWholeRows(testDb(), 'terms', { ids: [news.id] });
    expect(result).toEqual({ restored: 0, skipped: 1 });
    expect(await testDb().select().from(terms)).toHaveLength(1);
  });
});

describe('the daily job', () => {
  it('clears trash entries past the window and keeps newer ones', async () => {
    const now = new Date('2027-03-01T00:00:00Z');
    const [old, recent] = [await addRedirect('/old'), await addRedirect('/recent')];
    await trashWholeRows(testDb(), 'redirects', {
      ids: [old.id],
      userId,
      now: new Date(now.getTime() - days(MEDIA_TRASH_DAYS + 1)),
    });
    await trashWholeRows(testDb(), 'redirects', {
      ids: [recent.id],
      userId,
      now: new Date(now.getTime() - days(1)),
    });

    await purgeTrashedContent(env.DB, now);

    const left = await testDb()
      .select()
      .from(trashedRows)
      .where(and(eq(trashedRows.area, 'redirects')));
    expect(left.map((t) => t.rowId)).toEqual([recent.id]);
  });
});

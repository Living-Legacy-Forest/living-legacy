import { type RichTextDoc, emptyPostInput } from '@ll/content';
import { activityLog, faqs, posts, publishEvents, revisions, siteSettings } from '@ll/db/schema';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { createDraft, publishValues, saveEdits } from './post-store';
import { findMatches, replaceMatches } from './search-replace-store';

const input = {
  find: 'Mornington Green',
  replace: 'Living Legacy Mornington',
  matchCase: false,
  wholeWords: false,
};

const body = (text: string) =>
  ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }) as RichTextDoc;

beforeEach(async () => {
  for (const table of [publishEvents, revisions, activityLog, posts, faqs, siteSettings]) {
    await testDb().delete(table);
  }
});

/** A published post about Mornington Green, with pending edits that mention it too. */
async function publishedPost(userId: string) {
  const db = testDb();
  const draft = await createDraft(
    db,
    {
      ...emptyPostInput,
      title: 'A day at Mornington Green',
      slug: 'a-day',
      body: body('Mornington Green is in Somerville.'),
    },
    userId
  );
  const values = {
    ...emptyPostInput,
    title: 'A day at Mornington Green',
    slug: 'a-day',
    body: body('Mornington Green is in Somerville.'),
  };
  await publishValues(db, draft, values, userId, 'Sam');
  const live = (await db.query.posts.findFirst({ where: eq(posts.id, draft.id) }))!;
  await saveEdits(db, live, { ...values, excerpt: 'Visit mornington green soon' }, userId);
  return draft.id;
}

describe('findMatches', () => {
  it('lists matches by area, live and in pending edits, with snippets', async () => {
    const userId = await addUser('admin');
    await publishedPost(userId);
    await testDb().insert(faqs).values({ question: 'Where is Mornington Green?', answer: null });

    const areas = await findMatches(testDb(), input);
    const postsArea = areas.find((a) => a.area === 'posts')!;
    expect(postsArea.items).toHaveLength(1);
    expect(postsArea.items[0]!.fields.map((f) => f.label)).toEqual([
      'Title',
      'Body',
      'Title (pending edits)',
      'Summary (pending edits)',
      'Body (pending edits)',
    ]);
    expect(postsArea.count).toBe(5);
    expect(postsArea.items[0]!.fields[1]!.snippets[0]).toMatchObject({
      match: 'Mornington Green',
    });
    expect(areas.find((a) => a.area === 'faqs')?.count).toBe(1);
  });
});

describe('replaceMatches', () => {
  it('changes a published post live and in its pending edits, and records it', async () => {
    const userId = await addUser('admin');
    const id = await publishedPost(userId);
    const db = testDb();
    const revisionsBefore = (await db.select().from(revisions).where(eq(revisions.entityId, id)))
      .length;

    const result = await replaceMatches(db, input, ['posts'], { id: userId, name: 'Sam' });
    expect(result).toEqual({ matches: 5, items: 1 });

    const row = (await db.query.posts.findFirst({ where: eq(posts.id, id) }))!;
    expect(row.title).toBe('A day at Living Legacy Mornington');
    expect(JSON.stringify(row.body)).toContain('Living Legacy Mornington is in Somerville.');
    expect((row.draft as { excerpt: string }).excerpt).toBe('Visit Living Legacy Mornington soon');

    // A new revision holds the new live text; the one before keeps the old.
    const history = await db.select().from(revisions).where(eq(revisions.entityId, id));
    expect(history).toHaveLength(revisionsBefore + 1);
    const updates = await db
      .select()
      .from(publishEvents)
      .where(and(eq(publishEvents.entityId, id), eq(publishEvents.action, 'update')));
    expect(updates).toHaveLength(1);
    const [log] = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, 'content.replaced'));
    expect(log?.summary).toContain('5 matches in 1 item');
  });

  it('only touches the areas chosen, and changes nothing when there is no match', async () => {
    const userId = await addUser('admin');
    const db = testDb();
    await db.insert(faqs).values({ question: 'Where is Mornington Green?', answer: null });
    await publishedPost(userId);

    await replaceMatches(db, input, ['faqs'], { id: userId, name: 'Sam' });
    const [faq] = await db.select().from(faqs);
    expect(faq?.question).toBe('Where is Living Legacy Mornington?');
    const [post] = await db.select().from(posts);
    expect(post?.title).toBe('A day at Mornington Green');

    const none = await replaceMatches(db, { ...input, find: 'Nowhere' }, ['faqs'], {
      id: userId,
      name: 'Sam',
    });
    expect(none).toEqual({ matches: 0, items: 0 });
  });

  it('replaces in the site settings', async () => {
    const userId = await addUser('admin');
    const db = testDb();
    await db.insert(siteSettings).values({
      id: 'site',
      data: { siteTitle: 'Mornington Green', tagline: 'Trees at Mornington Green' },
    });
    await replaceMatches(db, input, ['settings'], { id: userId, name: 'Sam' });
    const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 'site') });
    expect(row?.data).toMatchObject({
      siteTitle: 'Living Legacy Mornington',
      tagline: 'Trees at Living Legacy Mornington',
    });
  });
});

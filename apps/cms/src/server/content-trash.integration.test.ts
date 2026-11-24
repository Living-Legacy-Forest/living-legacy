// The trash for team members, FAQs and testimonials against local D1: deleting moves a row to
// the trash, Undo brings it back as it was, and the daily job empties what has waited 30 days.
import { MEDIA_TRASH_DAYS } from '@ll/content';
import { faqs, mediaCoverage, posts, teamMembers, testimonials } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, days, testDb } from '../../test/fixtures';
import { env } from 'cloudflare:workers';
import { purgeTrashedContent, restoreRows, trashRows } from './content-trash';

let userId = '';

beforeEach(async () => {
  const db = testDb();
  await db.delete(posts);
  await db.delete(teamMembers);
  await db.delete(faqs);
  await db.delete(testimonials);
  await db.delete(mediaCoverage);
  userId = await addUser('admin');
});

async function addMember(name: string) {
  const [row] = await testDb().insert(teamMembers).values({ name }).returning();
  return row!;
}

const member = async (id: string) =>
  testDb().query.teamMembers.findFirst({ where: eq(teamMembers.id, id) });

describe('trashRows', () => {
  it('moves rows to the trash and leaves the rest', async () => {
    const [a, b] = [await addMember('Ada'), await addMember('Bo')];
    const now = new Date('2027-01-20T09:00:00Z');
    await trashRows(testDb(), 'team', { ids: [a.id], userId, now });
    expect((await member(a.id))?.deletedAt).toEqual(now);
    expect((await member(a.id))?.updatedBy).toBe(userId);
    expect((await member(b.id))?.deletedAt).toBeNull();
  });

  it('keeps the time a row first went, so deleting it again does not restart its 30 days', async () => {
    const a = await addMember('Ada');
    const first = new Date('2027-01-01T00:00:00Z');
    await trashRows(testDb(), 'team', { ids: [a.id], userId, now: first });
    await trashRows(testDb(), 'team', { ids: [a.id], userId, now: new Date('2027-01-10') });
    expect((await member(a.id))?.deletedAt).toEqual(first);
  });
});

describe('restoreRows', () => {
  it('brings a row back as it was', async () => {
    const [row] = await testDb()
      .insert(faqs)
      .values({ question: 'Can I visit?', answer: { type: 'text', text: 'Yes.' }, tags: ['home'] })
      .returning();
    await trashRows(testDb(), 'faqs', { ids: [row!.id], userId });
    await restoreRows(testDb(), 'faqs', { ids: [row!.id], userId });
    const back = await testDb().query.faqs.findFirst({ where: eq(faqs.id, row!.id) });
    expect(back).toMatchObject({ question: 'Can I visit?', tags: ['home'], deletedAt: null });
  });
});

describe('media coverage', () => {
  const addItem = async (slug: string) =>
    (
      await testDb()
        .insert(mediaCoverage)
        .values({ title: slug, slug, source: 'Herald', externalUrl: 'https://example.test/a' })
        .returning()
    )[0]!;

  it('goes to the trash and comes back, and frees its slug while it waits', async () => {
    const item = await addItem('big-news');
    await trashRows(testDb(), 'coverage', { ids: [item.id], userId });
    // The unique slug only counts live rows, so a new item can take it meanwhile.
    await addItem('big-news');
    await restoreRows(testDb(), 'coverage', { ids: [item.id], userId }).catch(() => {});
    const rows = await testDb().select().from(mediaCoverage);
    expect(rows).toHaveLength(2);
  });
});

describe('long lists', () => {
  it('go to the trash and come back past the 100 values a query allows', async () => {
    const ids: string[] = [];
    // A few at a time: the setup has the same limit as the code under test.
    for (let i = 0; i < 120; i += 5) {
      const rows = await testDb()
        .insert(teamMembers)
        .values(Array.from({ length: 5 }, (_, j) => ({ name: `Member ${i + j}` })))
        .returning({ id: teamMembers.id });
      ids.push(...rows.map((r) => r.id));
    }

    await trashRows(testDb(), 'team', { ids, userId });
    const trashed = await testDb().select().from(teamMembers);
    expect(trashed.every((m) => m.deletedAt !== null)).toBe(true);

    await restoreRows(testDb(), 'team', { ids, userId });
    const back = await testDb().select().from(teamMembers);
    expect(back.every((m) => m.deletedAt === null)).toBe(true);
  });
});

describe('purgeTrashedContent', () => {
  it('deletes for good only what has been in the trash past the window, in every area', async () => {
    const now = new Date('2027-03-01T00:00:00Z');
    const old = new Date(now.getTime() - days(MEDIA_TRASH_DAYS + 1));
    const recent = new Date(now.getTime() - days(1));
    const [gone, waiting, live] = [
      await addMember('Gone'),
      await addMember('Waiting'),
      await addMember('Live'),
    ];
    await trashRows(testDb(), 'team', { ids: [gone.id], userId, now: old });
    await trashRows(testDb(), 'team', { ids: [waiting.id], userId, now: recent });
    const [quote] = await testDb()
      .insert(testimonials)
      .values({ quote: 'Lovely.', name: 'Jo' })
      .returning();
    await trashRows(testDb(), 'testimonials', { ids: [quote!.id], userId, now: old });

    await purgeTrashedContent(env.DB, now);

    expect(await member(gone.id)).toBeUndefined();
    expect(await member(waiting.id)).toBeDefined();
    expect(await member(live.id)).toBeDefined();
    expect(
      await testDb().query.testimonials.findFirst({ where: eq(testimonials.id, quote!.id) })
    ).toBeUndefined();
  });

  it('leaves the posts of an author it deletes, without the byline', async () => {
    const now = new Date('2027-03-01T00:00:00Z');
    const author = await addMember('Ada');
    const [post] = await testDb()
      .insert(posts)
      .values({ title: 'Planting day', slug: 'planting-day', authorId: author.id })
      .returning();
    await trashRows(testDb(), 'team', {
      ids: [author.id],
      userId,
      now: new Date(now.getTime() - days(MEDIA_TRASH_DAYS + 1)),
    });

    await purgeTrashedContent(env.DB, now);

    const kept = await testDb().query.posts.findFirst({ where: eq(posts.id, post!.id) });
    expect(kept).toMatchObject({ title: 'Planting day', authorId: null });
  });
});

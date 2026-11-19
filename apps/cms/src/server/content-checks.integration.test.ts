// The brand language check, against local D1: which published content it reads, and which it leaves.
import { events, faqs, legalPages, locations, posts, siteSettings } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, days, testDb } from '../../test/fixtures';
import { loadContentChecks } from './content-checks';

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const soon = () => new Date(Date.now() + days(10));
const past = () => new Date(Date.now() - days(10));

beforeEach(async () => {
  const db = testDb();
  await db.delete(posts);
  await db.delete(faqs);
  await db.delete(events);
  await db.delete(locations);
  await db.delete(legalPages);
  await db.delete(siteSettings);
});

const brand = async () => (await loadContentChecks(testDb())).brand;

describe('brand language check', () => {
  it('finds published content that uses a word the guide rules out, in every type it reads', async () => {
    const db = testDb();
    await db.insert(posts).values({
      title: 'Choosing a plot',
      slug: 'choosing',
      status: 'published',
      body: doc('A calm place to remember.'),
    });
    await db
      .insert(faqs)
      .values({ question: 'What is a grave?', answer: doc('Fine.'), status: 'published' });
    await db.insert(events).values({
      title: 'Open day',
      slug: 'open-day',
      startsAt: soon(),
      endsAt: soon(),
      status: 'published',
      description: doc('Walk the final resting place.'),
    });
    await db.insert(locations).values({
      name: 'Living Legacy Somewhere',
      slug: 'somewhere',
      state: 'VIC',
      stage: 'live',
      status: 'published',
      about: 'Act now to book.',
    });
    await db.insert(legalPages).values({
      slug: 'terms',
      title: 'Terms',
      status: 'published',
      body: doc('Mornington Green'),
    });

    const { total, rows } = await brand();
    expect(total).toBe(5);
    expect(rows.map((r) => r.kind).sort()).toEqual(['event', 'faq', 'legal', 'location', 'post']);
    expect(rows.find((r) => r.kind === 'post')?.never).toEqual([
      { found: 'plot', count: 1, instead: 'Legacy Ground, or their tree' },
    ]);
    // A legal page is opened by its slug.
    expect(rows.find((r) => r.kind === 'legal')?.slug).toBe('terms');
  });

  it('leaves out drafts, the trash, clean content and events that are over', async () => {
    const db = testDb();
    await db.insert(posts).values([
      { title: 'A plot (draft)', slug: 'draft', status: 'draft' },
      { title: 'A plot (trashed)', slug: 'trashed', status: 'published', deletedAt: new Date() },
      { title: 'A calm post', slug: 'calm', status: 'published', body: doc('Quiet and kind.') },
    ]);
    await db.insert(events).values({
      title: 'A grave event',
      slug: 'old',
      startsAt: past(),
      endsAt: past(),
      status: 'published',
    });
    const { total, rows } = await brand();
    expect(total).toBe(0);
    expect(rows).toEqual([]);
  });

  it('lists a repeating event once, however many dates it has', async () => {
    await testDb()
      .insert(events)
      .values(
        ['a', 'b', 'c'].map((suffix) => ({
          title: 'Open day',
          slug: `open-${suffix}`,
          seriesId: 'series-1',
          startsAt: soon(),
          endsAt: soon(),
          status: 'published' as const,
          summary: 'Plots available',
        }))
      );
    expect((await brand()).total).toBe(1);
  });

  it('judges by the guide an admin has edited in Settings, not the starting list', async () => {
    const admin = await addUser('admin');
    await testDb()
      .insert(siteSettings)
      .values({
        id: 'site',
        updatedBy: admin,
        data: {
          brandRules: [{ match: 'forever home', instead: 'Legacy Ground', severity: 'critical' }],
        },
      });
    await testDb()
      .insert(posts)
      .values([
        { title: 'Their forever home', slug: 'home', status: 'published' },
        { title: 'A plot', slug: 'plot', status: 'published' },
      ]);
    const { rows } = await brand();
    expect(rows.map((r) => r.title)).toEqual(['Their forever home']);
  });

  it('puts the item with the most to fix first', async () => {
    await testDb()
      .insert(posts)
      .values([
        { title: 'A', slug: 'a', status: 'published', excerpt: 'One plot.' },
        { title: 'B', slug: 'b', status: 'published', excerpt: 'Plots, plots and a grave.' },
      ]);
    expect((await brand()).rows.map((r) => r.title)).toEqual(['B', 'A']);
  });
});

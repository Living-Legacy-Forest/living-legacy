// The brand language check, against local D1: which published content it reads, and which it leaves.
import {
  announcements,
  events,
  faqs,
  legalPages,
  locations,
  posts,
  redirects,
  siteSettings,
} from '@ll/db/schema';
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
  await db.delete(redirects);
  await db.delete(announcements);
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

  it("reads a legal page's search description too", async () => {
    await testDb()
      .insert(legalPages)
      .values({
        slug: 'privacy',
        title: 'Privacy',
        status: 'published',
        seoDescription: 'Where your plot is kept',
        body: doc('Quiet and kind.'),
      });
    expect((await brand()).rows.map((r) => r.kind)).toEqual(['legal']);
  });

  it('checks a date of a repeating event that was edited on its own', async () => {
    await testDb()
      .insert(events)
      .values(
        [
          { slug: 'a', summary: 'A calm morning' },
          { slug: 'b', summary: 'Plots available' },
          { slug: 'c', summary: 'A calm morning' },
        ].map((e) => ({
          ...e,
          title: 'Open day',
          seriesId: 'series-1',
          startsAt: soon(),
          endsAt: soon(),
          status: 'published' as const,
        }))
      );
    expect((await brand()).total).toBe(1);
  });

  it("reads a location's about as a document, so formatting does not hide a name", async () => {
    const about = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Earth' },
            { type: 'text', text: 'saphe', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    });
    await testDb().insert(locations).values({
      name: 'Living Legacy Somewhere',
      slug: 'somewhere',
      state: 'VIC',
      stage: 'live',
      status: 'published',
      about,
    });
    const { rows } = await brand();
    expect(rows[0]?.never[0]).toMatchObject({ found: 'Earthsaphe', instead: 'EarthSApHE' });
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

const withLinks = (...hrefs: string[]) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: hrefs.flatMap((href, i) => [
        { type: 'text', text: `link ${i} `, marks: [{ type: 'link', attrs: { href } }] },
        { type: 'text', text: ' and ' },
      ]),
    },
  ],
});
const links = async () => (await loadContentChecks(testDb())).links;

describe('announcement bars', () => {
  const bar = (over: Partial<typeof announcements.$inferInsert> = {}) => ({
    title: 'November bar',
    message: 'Walk the Living Legacy Forest',
    ...over,
  });

  it('reads the wording on a live bar, not its internal title', async () => {
    await testDb()
      .insert(announcements)
      .values([
        bar({ title: 'About plots', message: 'Quiet and kind.' }),
        bar({ title: 'Clean title', messageDesktop: 'Book a plot today', ctaLabel: 'Act now' }),
      ]);
    const { rows } = await brand();
    expect(rows.map((r) => [r.kind, r.title])).toEqual([['announcement', 'Clean title']]);
    expect(rows[0]?.never.map((f) => f.found).sort()).toEqual(['Act now', 'plot']);
  });

  it('leaves out bars that are off or over, and reads one still to start', async () => {
    await testDb()
      .insert(announcements)
      .values([
        bar({ title: 'Off', message: 'A plot', enabled: false }),
        bar({ title: 'Over', message: 'A plot', endsAt: past() }),
        bar({ title: 'Later', message: 'A plot', startsAt: soon() }),
      ]);
    expect((await brand()).rows.map((r) => r.title)).toEqual(['Later']);
  });

  it('finds a button that goes to a page the site does not have, and not one that works', async () => {
    await testDb()
      .insert(announcements)
      .values([
        bar({ title: 'Broken', ctaLabel: 'Read more', ctaUrl: '/nowhere' }),
        bar({ title: 'Other site', ctaLabel: 'Read more', ctaUrl: 'https://example.com/x' }),
        bar({ title: 'No button' }),
      ]);
    const { rows } = (await loadContentChecks(testDb())).links;
    expect(rows.map((r) => [r.kind, r.title])).toEqual([['announcement', 'Broken']]);
    expect(rows[0]?.broken[0]).toMatchObject({ href: '/nowhere', text: 'Read more' });
  });
});

describe('broken link check', () => {
  it('finds links to pages that are not there, in every type it reads', async () => {
    const db = testDb();
    await db.insert(posts).values({
      title: 'A post',
      slug: 'a-post',
      status: 'published',
      body: withLinks('/old-page'),
    });
    await db
      .insert(faqs)
      .values({ question: 'Q?', answer: withLinks('/old-faq-page'), status: 'published' });
    await db.insert(events).values({
      title: 'Open day',
      slug: 'open-day',
      startsAt: soon(),
      endsAt: soon(),
      status: 'published',
      description: withLinks('/old-event-page'),
    });
    await db.insert(locations).values({
      name: 'Living Legacy Somewhere',
      slug: 'somewhere',
      state: 'VIC',
      stage: 'live',
      status: 'published',
      about: JSON.stringify(withLinks('/old-location-page')),
    });
    await db.insert(legalPages).values({
      slug: 'terms',
      title: 'Terms',
      status: 'published',
      body: withLinks('/old-legal-page'),
    });

    const { total, rows } = await links();
    expect(total).toBe(5);
    expect(rows.map((r) => r.kind).sort()).toEqual(['event', 'faq', 'legal', 'location', 'post']);
    expect(rows.find((r) => r.kind === 'post')?.broken).toEqual([
      { href: '/old-page', text: 'link 0', reason: 'missing' },
    ]);
  });

  it('passes links to pages the site serves, ones a redirect catches, and other sites', async () => {
    const db = testDb();
    await db.insert(redirects).values({ fromPath: '/moved', toPath: '/contact', statusCode: 301 });
    await db.insert(posts).values([
      { title: 'Target', slug: 'target', status: 'published' },
      {
        title: 'Linker',
        slug: 'linker',
        status: 'published',
        body: withLinks(
          '/contact',
          '/blog/target',
          '/moved',
          'https://other.example/page',
          'https://livinglegacy.com.au/faqs/#top',
          '/documents/guide.pdf',
          'mailto:hello@example.com'
        ),
      },
    ]);
    expect((await links()).total).toBe(0);
  });

  it('fails a link to a draft post, a trashed post, an off redirect and a page marked as gone', async () => {
    const db = testDb();
    await db.insert(redirects).values([
      { fromPath: '/removed', toPath: '', statusCode: 410 },
      { fromPath: '/switched-off', toPath: '/contact', statusCode: 301, enabled: false },
    ]);
    await db.insert(posts).values([
      { title: 'A draft', slug: 'a-draft', status: 'draft' },
      { title: 'A trashed one', slug: 'trashed', status: 'published', deletedAt: new Date() },
      {
        title: 'Linker',
        slug: 'linker',
        status: 'published',
        body: withLinks('/blog/a-draft', '/blog/trashed', '/switched-off', '/removed'),
      },
    ]);
    const { rows } = await links();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.broken.map((b) => [b.href, b.reason])).toEqual([
      ['/blog/a-draft', 'missing'],
      ['/blog/trashed', 'missing'],
      ['/switched-off', 'missing'],
      ['/removed', 'gone'],
    ]);
  });

  it('does not call a forest that has its own site a broken link target', async () => {
    const db = testDb();
    await db.insert(locations).values([
      { name: 'Here', slug: 'here', state: 'VIC', stage: 'live', status: 'published' },
      {
        name: 'Elsewhere',
        slug: 'elsewhere',
        state: 'NSW',
        stage: 'external',
        status: 'published',
      },
    ]);
    await db.insert(posts).values({
      title: 'Linker',
      slug: 'linker',
      status: 'published',
      body: withLinks('/locations/here', '/locations/elsewhere'),
    });
    const { rows } = await links();
    expect(rows[0]?.broken.map((b) => b.href)).toEqual(['/locations/elsewhere']);
  });

  it('puts the item with the most broken links first', async () => {
    await testDb()
      .insert(posts)
      .values([
        { title: 'One', slug: 'one', status: 'published', body: withLinks('/x') },
        { title: 'Three', slug: 'three', status: 'published', body: withLinks('/a', '/b', '/c') },
      ]);
    expect((await links()).rows.map((r) => r.title)).toEqual(['Three', 'One']);
  });
});

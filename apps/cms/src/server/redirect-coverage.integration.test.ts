// Redirect coverage against local D1: the redirects that are on, and the pages the new site serves.
import { locations, posts, redirects } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../test/fixtures';
import { coverageFor } from './redirect-coverage';

const check = (text: string) => coverageFor(testDb(), text);

beforeEach(async () => {
  const db = testDb();
  await db.delete(redirects);
  await db.delete(posts);
  await db.delete(locations);
});

describe('checkRedirectCoverage', () => {
  it('sorts old addresses by the redirects that are on and the pages the new site has', async () => {
    const db = testDb();
    await db.insert(redirects).values([
      { fromPath: '/old-about', toPath: '/contact', statusCode: 301 },
      { fromPath: '/off', toPath: '/contact', statusCode: 301, enabled: false },
      { fromPath: '/news/*', toPath: '/blog/*', statusCode: 301 },
    ]);
    await db.insert(posts).values([
      { title: 'Kept', slug: 'kept', status: 'published' },
      { title: 'Draft', slug: 'draft', status: 'draft' },
      { title: 'Trashed', slug: 'trashed', status: 'published', deletedAt: new Date() },
    ]);
    await db.insert(locations).values([
      { name: 'Living Legacy A', slug: 'a', state: 'VIC', stage: 'live', status: 'published' },
      {
        name: 'Elsewhere',
        slug: 'elsewhere',
        state: 'NSW',
        stage: 'external',
        status: 'published',
      },
    ]);

    const result = await check(
      [
        '/old-about',
        '/off',
        '/news/2019/hello',
        '/blog/kept',
        '/blog/draft',
        '/blog/trashed',
        '/locations/a',
        '/locations/elsewhere',
        '/contact',
        '/?p=12',
      ].join('\n')
    );

    expect(result.rows.map((r) => [r.path, r.status])).toEqual([
      ['/old-about', 'redirected'],
      ['/off', 'missing'],
      ['/news/2019/hello', 'redirected'],
      ['/blog/kept', 'live'],
      ['/blog/draft', 'missing'],
      ['/blog/trashed', 'missing'],
      ['/locations/a', 'live'],
      ['/locations/elsewhere', 'missing'],
      ['/contact', 'live'],
    ]);
    expect(result.rows[2]).toMatchObject({ to: '/blog/2019/hello', viaWildcard: true });
    expect(result.ignored).toEqual(['/?p=12']);
    expect(result.ignoredCount).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it('checks nothing when nothing is pasted', async () => {
    expect(await check('  \n ')).toEqual({
      rows: [],
      ignored: [],
      ignoredCount: 0,
      truncated: false,
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { RedirectRule } from './redirects';
import { duplicateSearchText, redirectedPages } from './seo-checks';

const page = (id: string, title: string, seoTitle = '', excerpt = '', seoDescription = '') => ({
  id,
  title,
  seoTitle,
  seoDescription,
  excerpt,
});

describe('duplicateSearchText', () => {
  it('finds posts that share a search title, ignoring case and spacing', () => {
    const found = duplicateSearchText([
      page('a', 'Living with grief', 'Coping with Loss'),
      page('b', 'Another', '  coping   with loss '),
      page('c', 'Different', 'Something else'),
    ]);
    expect(found).toEqual([
      {
        kind: 'title',
        text: 'Coping with Loss',
        posts: [
          { id: 'a', title: 'Living with grief' },
          { id: 'b', title: 'Another' },
        ],
      },
    ]);
  });

  it('reads the post title when no search title is set', () => {
    const found = duplicateSearchText([page('a', 'Memorial trees'), page('b', 'memorial trees')]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'title', text: 'Memorial trees' });
  });

  it('reads the excerpt when no search description is set', () => {
    const found = duplicateSearchText([
      page('a', 'One', '', 'A calm place to remember.'),
      page('b', 'Two', '', 'A calm place to remember.'),
    ]);
    expect(found).toEqual([
      expect.objectContaining({ kind: 'description', text: 'A calm place to remember.' }),
    ]);
  });

  it('lists a title and a description that are both shared as two findings', () => {
    const found = duplicateSearchText([
      page('a', 'One', 'Same', '', 'Same words'),
      page('b', 'Two', 'Same', '', 'Same words'),
    ]);
    expect(found.map((f) => f.kind).sort()).toEqual(['description', 'title']);
  });

  it('ignores blanks and text used once', () => {
    expect(
      duplicateSearchText([page('a', '', '', ''), page('b', '', '', ''), page('c', 'Only one')])
    ).toEqual([]);
  });

  it('puts the most shared text first', () => {
    const found = duplicateSearchText([
      page('a', 'x', 'Pair'),
      page('b', 'y', 'Pair'),
      page('c', 'z', 'Trio'),
      page('d', 'w', 'Trio'),
      page('e', 'v', 'Trio'),
    ]);
    expect(found.map((f) => f.text)).toEqual(['Trio', 'Pair']);
  });
});

describe('redirectedPages', () => {
  const rule = (fromPath: string, toPath: string, statusCode: RedirectRule['statusCode'] = 301) =>
    ({ id: fromPath, fromPath, toPath, statusCode, keepQuery: false }) satisfies RedirectRule;
  const posts = [
    { id: 'a', title: 'Alpha', path: '/blog/alpha' },
    { id: 'b', title: 'Beta', path: '/blog/beta' },
  ];

  it('finds a page an enabled redirect sends away, with where it goes', () => {
    expect(redirectedPages(posts, [rule('/blog/alpha', '/blog/gamma/')])).toEqual([
      { id: 'a', title: 'Alpha', path: '/blog/alpha', to: '/blog/gamma/', gone: false },
    ]);
  });

  it('matches regardless of case or a trailing slash, and by wildcard', () => {
    expect(redirectedPages(posts, [rule('/Blog/Alpha/', '/x')]).map((p) => p.id)).toEqual(['a']);
    expect(redirectedPages(posts, [rule('/blog/*', '/news/*')]).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('reports a 410 as gone', () => {
    expect(redirectedPages(posts, [rule('/blog/beta', '', 410)])).toEqual([
      { id: 'b', title: 'Beta', path: '/blog/beta', to: null, gone: true },
    ]);
  });

  it('leaves alone a page nothing redirects', () => {
    expect(redirectedPages(posts, [rule('/blog/other', '/x')])).toEqual([]);
    expect(redirectedPages(posts, [])).toEqual([]);
  });

  it('does not count a rule that would send a page to itself', () => {
    expect(redirectedPages(posts, [rule('/blog/alpha', '/blog/alpha/')])).toEqual([]);
  });
});

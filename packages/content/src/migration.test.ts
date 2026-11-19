import { describe, expect, it } from 'vitest';
import {
  MAX_OLD_URLS,
  classifyCoverage,
  coverageCounts,
  liveSitePaths,
  parseOldUrls,
} from './migration';
import type { RedirectRule } from './redirects';

const rule = (fromPath: string, toPath: string, statusCode: RedirectRule['statusCode'] = 301) =>
  ({ id: fromPath, fromPath, toPath, statusCode, keepQuery: false }) satisfies RedirectRule;

describe('parseOldUrls', () => {
  it('reads one address a line, as paths or full URLs, lowercased and without the trailing slash', () => {
    const { paths } = parseOldUrls(
      ['/About-Us/', 'https://old.example.com/our-story/', '  /contact  '].join('\n')
    );
    expect(paths).toEqual(['/about-us', '/our-story', '/contact']);
  });

  it('keeps each address once, however it was written', () => {
    expect(parseOldUrls('/a\n/A/\nhttps://x.test/a/').paths).toEqual(['/a']);
  });

  it('takes the address column from a spreadsheet', () => {
    const csv = 'Page title,https://old.example.com/blog/one/,12\n"Two","/blog/two",3';
    expect(parseOldUrls(csv).paths).toEqual(['/blog/one', '/blog/two']);
  });

  it('reads a whole sitemap', () => {
    const xml = `<urlset><url><loc>https://old.example.com/a/</loc></url>
      <url><loc>https://old.example.com/b</loc><lastmod>2020-01-01</lastmod></url></urlset>`;
    expect(parseOldUrls(xml).paths).toEqual(['/a', '/b']);
  });

  it('sets aside an address with a query string, which a path rule cannot catch', () => {
    const { paths, ignored } = parseOldUrls('/?p=12\n/real-page\nhttps://x.test/?page_id=3');
    expect(paths).toEqual(['/real-page']);
    expect(ignored).toEqual(['/?p=12', 'https://x.test/?page_id=3']);
  });

  it('sets aside lines that are not addresses, and drops the hash', () => {
    const { paths, ignored } = parseOldUrls('hello there\n/page#section');
    expect(paths).toEqual(['/page']);
    expect(ignored).toEqual(['hello there']);
  });

  it('stops at the limit and says so', () => {
    const many = Array.from({ length: MAX_OLD_URLS + 5 }, (_, i) => `/page-${i}`).join('\n');
    const parsed = parseOldUrls(many);
    expect(parsed.paths).toHaveLength(MAX_OLD_URLS);
    expect(parsed.truncated).toBe(true);
  });
});

describe('classifyCoverage', () => {
  const live = liveSitePaths({
    postSlugs: ['kept-post'],
    locationSlugs: ['living-legacy-mornington'],
  });
  const rules = [
    rule('/old-about', '/contact'),
    rule('/blog/2019/*', '/blog'),
    rule('/gone', '', 410),
  ];

  it('sorts each address into redirected, still a page, or missing', () => {
    const rows = classifyCoverage(
      ['/old-about', '/blog/kept-post', '/locations/living-legacy-mornington', '/nowhere'],
      rules,
      live
    );
    expect(rows.map((r) => [r.path, r.status])).toEqual([
      ['/old-about', 'redirected'],
      ['/blog/kept-post', 'live'],
      ['/locations/living-legacy-mornington', 'live'],
      ['/nowhere', 'missing'],
    ]);
  });

  it('says where a redirect goes, and whether a wildcard catches it', () => {
    const [exact, wild, gone] = classifyCoverage(
      ['/old-about', '/blog/2019/some-post', '/gone'],
      rules,
      live
    );
    expect(exact).toMatchObject({ to: '/contact', statusCode: 301, viaWildcard: false });
    expect(wild).toMatchObject({ to: '/blog', viaWildcard: true });
    expect(gone).toMatchObject({ to: null, statusCode: 410 });
  });

  it('lets a redirect win over a page of the same address, as the website does', () => {
    const rows = classifyCoverage(['/contact'], [rule('/contact', '/somewhere-else')], live);
    expect(rows[0]).toMatchObject({ status: 'redirected', to: '/somewhere-else' });
  });

  it('counts each kind', () => {
    const rows = classifyCoverage(
      ['/old-about', '/contact', '/nowhere', '/also-nowhere'],
      rules,
      live
    );
    expect(coverageCounts(rows)).toEqual({ redirected: 1, live: 1, missing: 2 });
  });
});

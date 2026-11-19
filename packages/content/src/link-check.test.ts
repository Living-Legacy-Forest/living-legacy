import { describe, expect, it } from 'vitest';
import { brokenLinks, linkPath } from './link-check';
import { liveSitePaths } from './migration';
import type { RedirectRule } from './redirects';

const rule = (fromPath: string, toPath: string, statusCode: RedirectRule['statusCode'] = 301) =>
  ({ id: fromPath, fromPath, toPath, statusCode, keepQuery: false }) satisfies RedirectRule;

describe('linkPath', () => {
  it("reads a path, or this site's own address, without the query, the hash or the trailing slash", () => {
    expect(linkPath('/About-Us/#team')).toBe('/about-us');
    expect(linkPath('https://livinglegacy.com.au/blog/post/?utm_source=x')).toBe('/blog/post');
    expect(linkPath('https://www.livinglegacy.com.au/contact')).toBe('/contact');
  });

  it('leaves out what is not a page of this site', () => {
    expect(linkPath('https://other.example/page')).toBeNull();
    expect(linkPath('mailto:hello@example.com')).toBeNull();
    expect(linkPath('tel:0123456789')).toBeNull();
    expect(linkPath('#top')).toBeNull();
    expect(linkPath('page-without-slash')).toBeNull();
    expect(linkPath('//other.example/page')).toBeNull();
  });

  it('leaves out files and the parts of the site it cannot judge', () => {
    for (const href of [
      '/documents/brochure.pdf',
      '/media/photo.jpg',
      '/files/report.pdf',
      '/api/media/123',
      '/events/open-day',
      '/blog/category/news',
      '/blog/tag/forests',
      '/blog/author/sam',
      '/blog/page/2',
    ]) {
      expect(linkPath(href), href).toBeNull();
    }
  });

  it('still judges a page whose name merely starts like one of those', () => {
    expect(linkPath('/media-coverage')).toBe('/media-coverage');
    expect(linkPath('/blog')).toBe('/blog');
  });
});

describe('brokenLinks', () => {
  const live = liveSitePaths({ postSlugs: ['kept'], locationSlugs: ['living-legacy-mornington'] });
  const link = (href: string, text = 'a link') => ({ href, text });

  it('finds a link to a page that is not there and has no redirect', () => {
    expect(brokenLinks([link('/old-page', 'Old page')], [], live)).toEqual([
      { href: '/old-page', text: 'Old page', reason: 'missing' },
    ]);
  });

  it('passes links to pages the site serves', () => {
    const links = ['/', '/contact/', '/blog/kept', '/locations/living-legacy-mornington'].map((h) =>
      link(h)
    );
    expect(brokenLinks(links, [], live)).toEqual([]);
  });

  it('passes a link that a redirect catches', () => {
    expect(brokenLinks([link('/old-page')], [rule('/old-page', '/contact')], live)).toEqual([]);
    expect(brokenLinks([link('/news/2019/x')], [rule('/news/*', '/blog')], live)).toEqual([]);
  });

  it('fails a link to a page a redirect marks as gone', () => {
    expect(brokenLinks([link('/removed')], [rule('/removed', '', 410)], live)).toEqual([
      { href: '/removed', text: 'a link', reason: 'gone' },
    ]);
  });

  it('fails a link to a draft or removed post, which is not in the live set', () => {
    expect(brokenLinks([link('/blog/draft-post')], [], live)[0]?.reason).toBe('missing');
  });

  it('reports a page once, however many links go to it', () => {
    expect(
      brokenLinks(
        [link('/nope'), link('/nope/'), link('https://livinglegacy.com.au/nope')],
        [],
        live
      )
    ).toHaveLength(1);
  });

  it('says nothing about other sites or files', () => {
    expect(
      brokenLinks(
        [link('https://other.example/x'), link('/documents/a.pdf'), link('mailto:a@b.c')],
        [],
        live
      )
    ).toEqual([]);
  });
});

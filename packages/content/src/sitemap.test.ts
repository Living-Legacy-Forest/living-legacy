import { describe, expect, it } from 'vitest';
import { pageSitemapEntries, sitemapXml } from './sitemap';

const base = 'https://livinglegacy.com.au';

describe('sitemapXml', () => {
  it('lists each path as an absolute URL', () => {
    const xml = sitemapXml([{ path: '/faqs/' }], base);
    expect(xml).toContain('<loc>https://livinglegacy.com.au/faqs/</loc>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('writes lastmod as an ISO date from a string, number or Date', () => {
    const iso = '2026-11-20T01:02:03.000Z';
    const xml = sitemapXml(
      [
        { path: '/a/', lastmod: iso },
        { path: '/b/', lastmod: Date.parse(iso) },
        { path: '/c/', lastmod: new Date(iso) },
      ],
      base
    );
    expect(xml.match(new RegExp(`<lastmod>${iso}</lastmod>`, 'g'))).toHaveLength(3);
  });

  it('leaves lastmod out when it is missing or unreadable, instead of throwing', () => {
    const xml = sitemapXml(
      [
        { path: '/a/' },
        { path: '/b/', lastmod: null },
        { path: '/c/', lastmod: '' },
        { path: '/d/', lastmod: 'not a date' },
      ],
      base
    );
    expect(xml).not.toContain('<lastmod>');
    expect(xml.match(/<url>/g)).toHaveLength(4);
  });

  it('escapes characters that would break the XML', () => {
    const xml = sitemapXml([{ path: '/search/?a=1&b=<2>' }], base);
    expect(xml).toContain('a=1&amp;b=');
    expect(xml).not.toContain('&b=');
    expect(xml).not.toContain('<2>');
  });

  it('keeps the first entry when a path is listed twice', () => {
    const xml = sitemapXml(
      [
        { path: '/a/', lastmod: '2026-01-01' },
        { path: '/a/', lastmod: '2026-06-01' },
      ],
      base
    );
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain('2026-01-01');
  });

  it('is an empty urlset with no entries', () => {
    expect(sitemapXml([], base)).toMatch(/<urlset[^>]*><\/urlset>$/);
  });
});

describe('pageSitemapEntries', () => {
  const some = { count: 3, lastmod: 1_700_000_000_000 };
  const none = { count: 0, lastmod: null };
  const live = { stage: 'live', status: 'published', noindex: false, updatedAt: 5 } as const;
  const empty = { faqs: none, coverage: none, locations: [], legal: [] };

  it('lists nothing when there is nothing to show', () => {
    expect(pageSitemapEntries(empty)).toEqual([]);
  });

  it('lists the FAQs and In the media pages only when they have content', () => {
    const entries = pageSitemapEntries({ ...empty, faqs: some, coverage: none });
    expect(entries).toEqual([{ path: '/faqs/', lastmod: some.lastmod }]);
    expect(pageSitemapEntries({ ...empty, coverage: some })).toEqual([
      { path: '/about/in-the-media/', lastmod: some.lastmod },
    ]);
  });

  it('lists live published locations by slug, and only those', () => {
    const entries = pageSitemapEntries({
      ...empty,
      locations: [
        { ...live, slug: 'wellington' },
        { ...live, slug: 'hidden', noindex: true },
        { ...live, slug: 'draft', status: 'draft' },
        { ...live, slug: 'elsewhere', stage: 'external' },
        { ...live, slug: 'later', stage: 'coming_soon' },
        { ...live, slug: 'removed', deletedAt: new Date() },
        { ...live, slug: 'albany' },
      ],
    });
    expect(entries.map((e) => e.path)).toEqual(['/locations/albany/', '/locations/wellington/']);
  });

  it('passes the legal pages through after the rest', () => {
    const legal = [{ path: '/privacy/', lastmod: '2026-08-05T00:00:00.000Z' }];
    expect(pageSitemapEntries({ ...empty, faqs: some, legal }).at(-1)).toEqual(legal[0]);
  });
});

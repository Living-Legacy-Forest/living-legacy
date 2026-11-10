import { describe, expect, it } from 'vitest';
import {
  blogPostingJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from './structured-data';

const siteUrl = 'https://livinglegacy.com.au';

describe('organizationJsonLd', () => {
  it('drops empty optional fields', () => {
    const org = organizationJsonLd({
      siteUrl,
      name: 'Living Legacy Forest',
      email: '',
      sameAs: [],
    });
    expect(org).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://livinglegacy.com.au/#organization',
      name: 'Living Legacy Forest',
      url: 'https://livinglegacy.com.au/',
    });
  });
});

describe('websiteJsonLd', () => {
  it('points its publisher at the organisation', () => {
    const site = websiteJsonLd({ siteUrl, name: 'Living Legacy Forest', locale: 'en-AU' });
    expect(site.publisher).toEqual({ '@id': 'https://livinglegacy.com.au/#organization' });
    expect(site.inLanguage).toBe('en-AU');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers crumbs from 1 in order', () => {
    const crumbs = breadcrumbJsonLd([
      { name: 'Home', url: `${siteUrl}/` },
      { name: 'Blog', url: `${siteUrl}/blog/` },
    ]);
    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://livinglegacy.com.au/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://livinglegacy.com.au/blog/' },
    ]);
  });
});

describe('blogPostingJsonLd', () => {
  const base = {
    siteUrl,
    url: `${siteUrl}/blog/a-post/`,
    headline: 'A post',
    datePublished: '2026-10-01T00:00:00.000Z',
  };

  it('falls back to the published date when there is no update', () => {
    expect(blogPostingJsonLd(base).dateModified).toBe(base.datePublished);
  });

  it('links to the shared organisation and website and adds topics', () => {
    const post = blogPostingJsonLd({ ...base, section: 'News', keywords: ['trees', 'ashes'] });
    expect(post.publisher).toEqual({ '@id': 'https://livinglegacy.com.au/#organization' });
    expect(post.isPartOf).toEqual({ '@id': 'https://livinglegacy.com.au/#website' });
    expect(post.articleSection).toBe('News');
    expect(post.keywords).toBe('trees, ashes');
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script tag it sits in', () => {
    expect(serializeJsonLd({ name: '</script><b>' })).not.toContain('</script>');
  });
});

import { describe, expect, it } from 'vitest';
import {
  blogPostingJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  placeJsonLd,
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

describe('placeJsonLd', () => {
  const base = {
    siteUrl,
    url: 'https://livinglegacy.com.au/locations/mornington/',
    name: 'Living Legacy Mornington',
  };

  it('links the page to the website and leaves out what it was not given', () => {
    expect(placeJsonLd(base)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: 'Living Legacy Mornington',
      url: base.url,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': base.url,
        isPartOf: { '@id': 'https://livinglegacy.com.au/#website' },
      },
    });
  });

  it('adds the address with its state, and the pin when both coordinates are set', () => {
    const place = placeJsonLd({
      ...base,
      address: '1 Forest Rd, Mornington',
      region: 'Victoria',
      latitude: -38.2,
      longitude: 145.0,
    });
    expect(place.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '1 Forest Rd, Mornington',
      addressRegion: 'Victoria',
      addressCountry: 'AU',
    });
    expect(place.geo).toEqual({ '@type': 'GeoCoordinates', latitude: -38.2, longitude: 145.0 });
  });

  it('keeps a pin at zero, and drops a half-set one', () => {
    expect(placeJsonLd({ ...base, latitude: 0, longitude: 0 }).geo).toBeDefined();
    expect(placeJsonLd({ ...base, latitude: -38.2, longitude: null }).geo).toBeUndefined();
  });
});

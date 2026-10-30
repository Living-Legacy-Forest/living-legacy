import { describe, expect, it } from 'vitest';
import { type RedirectRule, resolveRedirect, traceRedirect } from './redirects';

let n = 0;
const rule = (
  fromPath: string,
  toPath: string,
  extra: Partial<RedirectRule> = {}
): RedirectRule => ({
  id: `r${++n}`,
  fromPath,
  toPath,
  statusCode: 301,
  keepQuery: true,
  ...extra,
});

describe('resolveRedirect', () => {
  const rules = [
    rule('/about', '/#about-section'),
    rule('/pricing', '/faqs/#pricing'),
    rule('/thank-you-*', '/thank-you-contact/'),
    rule('/blogs/*', '/blog/*/'),
    rule('/blog/cache-*', '/blog/'),
    rule('/old-offer', '/offer', { keepQuery: false }),
    rule('/removed', '', { statusCode: 410 }),
  ];
  const location = (path: string, search = '') => resolveRedirect(rules, path, search)?.location;

  it('matches exact paths ignoring case and a trailing slash', () => {
    expect(location('/About/')).toBe('/#about-section');
  });

  it('puts the query string before the hash', () => {
    expect(location('/pricing', '?utm_source=x')).toBe('/faqs/?utm_source=x#pricing');
  });

  it('drops the query string when keepQuery is off', () => {
    expect(location('/old-offer', '?utm_source=x')).toBe('/offer');
  });

  it('carries the wildcard match into the destination', () => {
    expect(location('/blogs/my-post/')).toBe('/blog/my-post/');
    expect(location('/blog/cache-12')).toBe('/blog/');
  });

  it('never sends a path to itself', () => {
    expect(location('/thank-you-contact/')).toBeUndefined();
    expect(location('/thank-you-old')).toBe('/thank-you-contact/');
  });

  it('reports a 410 without a location', () => {
    const match = resolveRedirect(rules, '/removed', '');
    expect(match?.rule.statusCode).toBe(410);
    expect(match?.location).toBeNull();
  });

  it('leaves unknown paths alone', () => {
    expect(resolveRedirect(rules, '/contact', '')).toBeNull();
  });
});

describe('traceRedirect', () => {
  it('finds a loop', () => {
    const existing = [rule('/b', '/a')];
    expect(traceRedirect(existing, rule('/a', '/b')).loop).toBe(true);
  });

  it('finds a chain', () => {
    const existing = [rule('/b', '/c'), rule('/c', '/d')];
    expect(traceRedirect(existing, rule('/a', '/b'))).toEqual({
      hops: ['/c', '/d'],
      loop: false,
      gone: false,
    });
  });

  it('finds a wildcard that matches its own destination', () => {
    expect(traceRedirect([], rule('/blog/*', '/blog/new/*')).loop).toBe(true);
  });

  it('notices a destination that is gone', () => {
    const existing = [rule('/b', '', { statusCode: 410 })];
    expect(traceRedirect(existing, rule('/a', '/b')).gone).toBe(true);
  });

  it('is clean for a plain redirect', () => {
    expect(traceRedirect([rule('/x', '/y')], rule('/a', '/b'))).toEqual({
      hops: [],
      loop: false,
      gone: false,
    });
  });
});

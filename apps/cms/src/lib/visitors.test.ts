import { describe, expect, it } from 'vitest';
import { deviceKind, trafficSource } from './visitors';

describe('trafficSource', () => {
  it('calls a visit with no referrer direct', () => {
    expect(trafficSource('$direct')).toEqual({ referrer: null, source: 'direct' });
    expect(trafficSource('')).toEqual({ referrer: null, source: 'direct' });
    expect(trafficSource(null)).toEqual({ referrer: null, source: 'direct' });
  });

  it('knows search engines, social sites and the site itself', () => {
    expect(trafficSource('www.google.com')).toEqual({ referrer: 'google.com', source: 'search' });
    expect(trafficSource('google.com.au').source).toBe('search');
    expect(trafficSource('duckduckgo.com').source).toBe('search');
    expect(trafficSource('search.brave.com').source).toBe('search');
    expect(trafficSource('l.facebook.com').source).toBe('social');
    expect(trafficSource('t.co').source).toBe('social');
    expect(trafficSource('www.livinglegacy.com.au').source).toBe('internal');
  });

  it('calls anything else a referral, keeping the domain', () => {
    expect(trafficSource('Funeral-Guide.com.au')).toEqual({
      referrer: 'funeral-guide.com.au',
      source: 'referral',
    });
    // A word inside another domain is not a search engine.
    expect(trafficSource('notgoogle.org').source).toBe('referral');
  });
});

describe('deviceKind', () => {
  it('reads PostHog device types', () => {
    expect(deviceKind('Desktop')).toBe('desktop');
    expect(deviceKind('Mobile')).toBe('mobile');
    expect(deviceKind('Tablet')).toBe('tablet');
    expect(deviceKind('Console')).toBeNull();
    expect(deviceKind(undefined)).toBeNull();
  });
});

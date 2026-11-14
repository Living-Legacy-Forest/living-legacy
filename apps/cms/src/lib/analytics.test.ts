import { describe, expect, it } from 'vitest';
import {
  analyticsSearch,
  channelOf,
  formatPercent,
  formatSeconds,
  pageName,
  percentOf,
  rangeInput,
  rollUp,
} from './analytics';

describe('channelOf', () => {
  it('takes paid and email from the campaign link', () => {
    expect(channelOf('google.com', 'cpc').channel).toBe('paid');
    expect(channelOf('facebook.com', 'Paid_Social').channel).toBe('paid');
    expect(channelOf('$direct', 'email').channel).toBe('email');
    expect(channelOf(null, 'Newsletter').channel).toBe('email');
  });

  it('otherwise goes by the site the visit came from', () => {
    expect(channelOf('www.google.com.au').channel).toBe('search');
    expect(channelOf('l.facebook.com', 'social').channel).toBe('social');
    expect(channelOf('$direct').channel).toBe('direct');
    expect(channelOf('example.org', 'referral').channel).toBe('referral');
  });

  it('keeps the referrer for the list of websites', () => {
    expect(channelOf('www.example.org', 'cpc')).toMatchObject({
      referrer: 'example.org',
      channel: 'paid',
    });
  });
});

describe('rollUp', () => {
  const rows = [
    { k: 'b', n: 2 },
    { k: 'a', n: 3 },
    { k: 'b', n: 4 },
    { k: null, n: 9 },
    { k: 'c', n: 3 },
  ];

  it('adds up each key, biggest first, ties by label, and drops rows with no key', () => {
    expect(
      rollUp(
        rows,
        (r) => r.k,
        (r) => r.n,
        (k) => k.toUpperCase()
      )
    ).toEqual([
      { key: 'b', label: 'B', value: 6 },
      { key: 'a', label: 'A', value: 3 },
      { key: 'c', label: 'C', value: 3 },
    ]);
  });
});

describe('formatting', () => {
  it('shows a length of time as seconds, minutes or hours', () => {
    expect(formatSeconds(null)).toBe('–');
    expect(formatSeconds(38.4)).toBe('38s');
    expect(formatSeconds(245)).toBe('4m 05s');
    expect(formatSeconds(3_900)).toBe('1h 05m');
  });

  it('shows a share, with a decimal only for small ones', () => {
    expect(formatPercent(null)).toBe('–');
    expect(formatPercent(42.4)).toBe('42%');
    expect(formatPercent(3.25)).toBe('3.3%');
    expect(formatPercent(0)).toBe('0%');
    expect(percentOf(1, 0)).toBeNull();
    expect(percentOf(1, 4)).toBe(25);
  });

  it('drops the site name from a page title, falling back to the path', () => {
    expect(pageName({ path: '/a', title: 'Planting day | Living Legacy' })).toBe('Planting day');
    expect(pageName({ path: '/b', title: 'About us — Living Legacy' })).toBe('About us');
    expect(pageName({ path: '/c', title: null })).toBe('/c');
  });
});

describe('periods', () => {
  it('accepts 7, 30 or 90 days and falls back to 30 on the server', () => {
    expect(rangeInput.parse({ days: 90 })).toEqual({ days: 90 });
    expect(rangeInput.parse({ days: 12 })).toEqual({ days: 30 });
    expect(rangeInput.parse({ days: 'x' })).toEqual({ days: 30 });
  });

  it('leaves an unknown period out of the address', () => {
    expect(analyticsSearch.parse({ days: 7 })).toEqual({ days: 7 });
    expect(analyticsSearch.parse({ days: 12 })).toEqual({ days: undefined });
  });
});

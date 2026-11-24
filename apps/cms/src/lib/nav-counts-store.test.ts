import { beforeEach, describe, expect, it } from 'vitest';
import {
  getNavCountsSnapshot,
  mergeNavCounts,
  resetNavCounts,
  setNavCount,
} from './nav-counts-store';

beforeEach(() => resetNavCounts());

describe('the sidebar numbers', () => {
  it('start empty', () => {
    expect(getNavCountsSnapshot()).toEqual({});
  });

  it('take what the server said once', () => {
    mergeNavCounts({ '/checks': 4, '/redirects': 2 });
    expect(getNavCountsSnapshot()).toEqual({ '/checks': 4, '/redirects': 2 });
  });

  it('follow a page that already has its own number, without another request', () => {
    mergeNavCounts({ '/checks': 4 });
    setNavCount('/checks', 3);
    expect(getNavCountsSnapshot()['/checks']).toBe(3);
  });

  it('keep a number a page set while the server’s answer was on its way', () => {
    setNavCount('/checks', 1);
    mergeNavCounts({ '/checks': 9, '/redirects': 2 });
    expect(getNavCountsSnapshot()).toEqual({ '/checks': 1, '/redirects': 2 });
  });

  it('keep the same snapshot when a page sets the number it already has', () => {
    setNavCount('/checks', 5);
    const snapshot = getNavCountsSnapshot();
    setNavCount('/checks', 5);
    expect(getNavCountsSnapshot()).toBe(snapshot);
  });

  it('are forgotten when someone else signs in', () => {
    mergeNavCounts({ '/checks': 4 });
    resetNavCounts();
    expect(getNavCountsSnapshot()).toEqual({});
  });
});

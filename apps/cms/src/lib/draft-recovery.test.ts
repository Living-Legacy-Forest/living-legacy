import { describe, expect, it } from 'vitest';
import {
  clearAllDrafts,
  clearDraft,
  draftKey,
  isStale,
  readDraft,
  worthOffering,
  writeDraft,
} from './draft-recovery';

/** A Storage that lives in a Map, so the module runs without a browser. */
function fakeStore(limit = Infinity) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limit) throw new DOMException('full', 'QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const NOW = Date.parse('2027-02-01T09:00:00Z');
const draft = { values: { title: 'Planting day' }, baseUpdatedAt: 100 };

describe('draftKey', () => {
  it('is per post, with one slot for a post not saved yet', () => {
    expect(draftKey('abc')).not.toBe(draftKey('def'));
    expect(draftKey(null)).toBe(draftKey(null));
    expect(draftKey(null)).not.toBe(draftKey('abc'));
  });
});

describe('writing and reading', () => {
  it('gives back what was written, with when', () => {
    const store = fakeStore();
    writeDraft('k', draft, NOW, store);
    expect(readDraft('k', NOW + 1000, store)).toEqual({ ...draft, savedAt: NOW });
  });

  it('reads nothing when there is none, or when it is not a draft', () => {
    const store = fakeStore();
    expect(readDraft('k', NOW, store)).toBeNull();
    store.setItem('k', 'not json');
    expect(readDraft('k', NOW, store)).toBeNull();
    store.setItem('k', JSON.stringify({ hello: 'world' }));
    expect(readDraft('k', NOW, store)).toBeNull();
    expect(store.map.has('k')).toBe(false);
  });

  it('forgets a draft after 30 days', () => {
    const store = fakeStore();
    writeDraft('k', draft, NOW, store);
    const day = 24 * 60 * 60 * 1000;
    expect(readDraft('k', NOW + 29 * day, store)).not.toBeNull();
    expect(readDraft('k', NOW + 31 * day, store)).toBeNull();
    expect(store.map.has('k')).toBe(false);
  });

  it('does not throw when storage is full or missing', () => {
    expect(() => writeDraft('k', draft, NOW, fakeStore(5))).not.toThrow();
    expect(() => writeDraft('k', draft, NOW, null)).not.toThrow();
    expect(readDraft('k', NOW, null)).toBeNull();
  });
});

describe('clearing', () => {
  it('removes one post’s draft', () => {
    const store = fakeStore();
    writeDraft('a', draft, NOW, store);
    writeDraft('b', draft, NOW, store);
    clearDraft('a', store);
    expect([...store.map.keys()]).toEqual(['b']);
  });

  it('removes every draft on sign-out, and nothing else', () => {
    const store = fakeStore();
    writeDraft(draftKey('a'), draft, NOW, store);
    writeDraft(draftKey(null), draft, NOW, store);
    store.setItem('ll-cms-sound', 'off');
    clearAllDrafts(store);
    expect([...store.map.keys()]).toEqual(['ll-cms-sound']);
  });
});

describe('worthOffering', () => {
  it('is false for no draft, or one that matches the saved post', () => {
    expect(worthOffering(null, { title: 'x' })).toBe(false);
    expect(worthOffering({ ...draft, savedAt: NOW }, { title: 'Planting day' })).toBe(false);
  });

  it('is true when the draft differs from the saved post', () => {
    expect(worthOffering({ ...draft, savedAt: NOW }, { title: 'Planting day, take two' })).toBe(
      true
    );
  });
});

describe('isStale', () => {
  it('is false when the post is as it was when the draft began', () => {
    expect(isStale({ ...draft, savedAt: NOW }, 100)).toBe(false);
    expect(isStale({ values: {}, baseUpdatedAt: null, savedAt: NOW }, undefined)).toBe(false);
  });

  it('is true once the post has been saved since', () => {
    expect(isStale({ ...draft, savedAt: NOW }, 250)).toBe(true);
  });
});

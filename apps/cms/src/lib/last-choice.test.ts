import { describe, expect, it } from 'vitest';
import { readLastChoice, rememberChoice } from './last-choice';

function fakeStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const any = () => true;

describe('last choice', () => {
  it('gives back what was remembered', () => {
    const store = fakeStore();
    rememberChoice('faq-group', 'g1', store);
    expect(readLastChoice('faq-group', any, store)).toBe('g1');
  });

  it('keeps each kind of choice apart', () => {
    const store = fakeStore();
    rememberChoice('faq-group', 'g1', store);
    expect(readLastChoice('post-author', any, store)).toBeNull();
  });

  it('is nothing when none was remembered', () => {
    expect(readLastChoice('faq-group', any, fakeStore())).toBeNull();
  });

  it('is nothing once what it pointed at has gone', () => {
    const store = fakeStore();
    rememberChoice('faq-group', 'deleted-group', store);
    expect(readLastChoice('faq-group', (id) => id === 'g1', store)).toBeNull();
  });

  it('forgets on null, as when someone chooses no author on purpose', () => {
    const store = fakeStore();
    rememberChoice('post-author', 'a1', store);
    rememberChoice('post-author', null, store);
    expect(readLastChoice('post-author', any, store)).toBeNull();
  });

  it('copes with storage that is missing or throws', () => {
    expect(() => rememberChoice('faq-group', 'g1', null)).not.toThrow();
    expect(readLastChoice('faq-group', any, null)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => rememberChoice('faq-group', 'g1', broken)).not.toThrow();
    expect(readLastChoice('faq-group', any, broken)).toBeNull();
  });
});

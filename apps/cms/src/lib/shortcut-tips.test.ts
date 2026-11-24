import { describe, expect, it } from 'vitest';
import { MAX_TIPS, TIP_AFTER, describeShortcut, noteMenuUse } from './shortcut-tips';

function fakeStore(initial?: string) {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => void (value = next),
  };
}

const publish = { key: 'p' };

describe('describeShortcut', () => {
  it('says the key the way someone would', () => {
    expect(describeShortcut({ key: 'p' }, true)).toBe('P');
    expect(describeShortcut({ key: 'Backspace' }, true)).toBe('Delete');
  });

  it('names Option on a Mac and Alt elsewhere', () => {
    expect(describeShortcut({ key: 'ArrowUp', alt: true }, true)).toBe('Option + ↑');
    expect(describeShortcut({ key: 'ArrowDown', alt: true }, false)).toBe('Alt + ↓');
  });
});

describe('noteMenuUse', () => {
  it('stays quiet until the action has been picked from the menu three times', () => {
    const store = fakeStore();
    for (let i = 1; i < TIP_AFTER; i++) {
      expect(noteMenuUse('Publish', publish, { store })).toBeNull();
    }
    expect(noteMenuUse('Publish', publish, { store })).toBe(
      'Click a row, then press P to publish.'
    );
  });

  it('says it only once for an action', () => {
    const store = fakeStore();
    for (let i = 0; i < TIP_AFTER; i++) noteMenuUse('Publish', publish, { store });
    expect(noteMenuUse('Publish', publish, { store })).toBeNull();
    expect(noteMenuUse('Publish', publish, { store })).toBeNull();
  });

  it('counts each action on its own', () => {
    const store = fakeStore();
    noteMenuUse('Publish', publish, { store });
    noteMenuUse('Publish', publish, { store });
    noteMenuUse('Feature', { key: 'f' }, { store });
    expect(noteMenuUse('Publish', publish, { store })).not.toBeNull();
    expect(noteMenuUse('Feature', { key: 'f' }, { store })).toBeNull();
  });

  it('keeps the case of names inside the label, and uses the modifier', () => {
    const store = fakeStore();
    let tip: string | null = null;
    for (let i = 0; i < TIP_AFTER; i++) {
      tip = noteMenuUse('Move up', { key: 'ArrowUp', alt: true }, { store, mac: true });
    }
    expect(tip).toBe('Click a row, then press Option + ↑ to move up.');
    for (let i = 0; i < TIP_AFTER; i++) {
      tip = noteMenuUse('Copy FAQ link', { key: 'c' }, { store });
    }
    expect(tip).toBe('Click a row, then press C to copy FAQ link.');
  });

  it('never teaches open or delete', () => {
    const store = fakeStore();
    for (let i = 0; i < 10; i++) {
      expect(noteMenuUse('Open', { key: 'Enter' }, { store })).toBeNull();
      expect(noteMenuUse('Delete', { key: 'Backspace' }, { store })).toBeNull();
    }
  });

  it('stops after three tips in all', () => {
    const store = fakeStore();
    const labels = ['Publish', 'Feature', 'Edit', 'Select'];
    const tips = labels.map((label) => {
      let tip: string | null = null;
      for (let i = 0; i < TIP_AFTER; i++) tip = noteMenuUse(label, { key: label[0]! }, { store });
      return tip;
    });
    expect(tips.filter(Boolean)).toHaveLength(MAX_TIPS);
    expect(tips.at(-1)).toBeNull();
  });

  it('copes with storage that is missing or holds something else', () => {
    expect(noteMenuUse('Publish', publish, { store: null })).toBeNull();
    expect(noteMenuUse('Publish', publish, { store: fakeStore('nonsense') })).toBeNull();
    expect(noteMenuUse('Publish', publish, { store: fakeStore('{"uses":5}') })).toBeNull();
  });
});

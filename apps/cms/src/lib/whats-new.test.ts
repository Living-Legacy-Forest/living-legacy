import { describe, expect, it } from 'vitest';
import { type WhatsNewEntry, unseenEntries } from './whats-new';

const entry = (id: string): WhatsNewEntry => ({ id, title: id, items: [] });
const entries = [entry('2026-12-01'), entry('2026-11-10')];
const day = (iso: string) => Date.parse(`${iso}T00:00:00+11:00`);

describe('unseenEntries', () => {
  it('shows entries newer than the last one seen, newest first', () => {
    expect(unseenEntries(entries, '2026-11-10', day('2026-01-01')).map((e) => e.id)).toEqual([
      '2026-12-01',
    ]);
  });

  it('shows nothing once the newest has been seen', () => {
    expect(unseenEntries(entries, '2026-12-01', day('2026-01-01'))).toEqual([]);
  });

  it('shows people who were here before an entry everything they have not seen', () => {
    expect(unseenEntries(entries, null, day('2026-11-01')).map((e) => e.id)).toEqual([
      '2026-12-01',
      '2026-11-10',
    ]);
  });

  it('keeps news from before someone joined out of their way', () => {
    expect(unseenEntries(entries, null, day('2026-11-20')).map((e) => e.id)).toEqual([
      '2026-12-01',
    ]);
    expect(unseenEntries(entries, null, day('2026-12-05'))).toEqual([]);
  });

  it('orders a second note on the same day after the first', () => {
    const sameDay = [entry('2026-11-10-2'), entry('2026-11-10')];
    expect(unseenEntries(sameDay, '2026-11-10', day('2026-01-01')).map((e) => e.id)).toEqual([
      '2026-11-10-2',
    ]);
    expect(unseenEntries(sameDay, null, day('2026-11-01'))).toHaveLength(2);
  });
});

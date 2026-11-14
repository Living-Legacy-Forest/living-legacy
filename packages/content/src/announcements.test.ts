import { describe, expect, it } from 'vitest';
import {
  type AnnouncementWindow,
  announcementClashes,
  announcementColours,
  announcementContrast,
  announcementStatus,
  currentAnnouncement,
  isAnnouncementBackground,
} from './announcements';

const day = 86_400_000;
const now = Date.UTC(2026, 10, 15);
const a = (id: string, extra: Partial<AnnouncementWindow> = {}): AnnouncementWindow => ({
  id,
  enabled: true,
  startsAt: null,
  endsAt: null,
  hidePaths: [],
  ...extra,
});

describe('announcementStatus', () => {
  it('follows the switch and the window', () => {
    expect(announcementStatus(a('x', { enabled: false }), now)).toBe('off');
    expect(announcementStatus(a('x', { startsAt: now + day }), now)).toBe('scheduled');
    expect(announcementStatus(a('x', { endsAt: now }), now)).toBe('ended');
    expect(announcementStatus(a('x', { startsAt: now - day, endsAt: now + day }), now)).toBe(
      'live'
    );
  });
});

describe('currentAnnouncement', () => {
  const standing = a('standing');
  const november = a('november', { startsAt: now - 14 * day, endsAt: now + 16 * day });
  const december = a('december', { startsAt: now + 16 * day });

  it('swaps by date, the most recent start winning', () => {
    const list = [standing, november, december];
    expect(currentAnnouncement(list, now)?.id).toBe('november');
    expect(currentAnnouncement(list, now + 20 * day)?.id).toBe('december');
    expect(currentAnnouncement([standing, december], now)?.id).toBe('standing');
  });

  it('respects hidden pages, including a trailing *', () => {
    const hidden = a('promo', { hidePaths: ['/events/open-days', '/blog/*'] });
    expect(currentAnnouncement([hidden], now, '/events/open-days/')).toBeNull();
    expect(currentAnnouncement([hidden], now, '/blog/a-post')).toBeNull();
    expect(currentAnnouncement([hidden], now, '/contact')?.id).toBe('promo');
  });
});

describe('announcementClashes', () => {
  it('lists overlapping windows, ignoring ended and switched-off ones', () => {
    const list = [
      a('nov', { startsAt: now - day, endsAt: now + 10 * day }),
      a('mid', { startsAt: now + 5 * day, endsAt: now + 20 * day }),
      a('dec', { startsAt: now + 20 * day }),
      a('old', { endsAt: now - day }),
      a('off', { enabled: false }),
    ];
    const clashes = announcementClashes(list, now);
    expect(clashes.get('nov')?.map((c) => c.id)).toEqual(['mid']);
    expect(clashes.get('dec')?.map((c) => c.id)).toEqual([]);
    expect(clashes.has('old')).toBe(false);
  });
});

describe('announcement backgrounds', () => {
  it('accepts the palette names and six-digit hex colours only', () => {
    for (const ok of ['moss', 'ink', 'sun', 'paper', '#2c4633', '#ABCDEF']) {
      expect(isAnnouncementBackground(ok)).toBe(true);
    }
    for (const bad of ['red', '#fff', '#12345678', '2c4633', '#gggggg', 'url(x)', '']) {
      expect(isAnnouncementBackground(bad)).toBe(false);
    }
  });

  it('keeps the palette exactly as the website shows it', () => {
    expect(announcementColours('moss')).toEqual({ bg: '#2c4633', fg: '#f6f2e9' });
    expect(announcementColours('sun')).toEqual({ bg: '#d8c493', fg: '#17231c' });
  });

  it('picks the more readable text for a picked colour', () => {
    expect(announcementColours('#0B1F3A').fg).toBe('#f6f2e9');
    expect(announcementColours('#F5E6A8')).toEqual({ bg: '#f5e6a8', fg: '#17231c' });
  });

  it('falls back to moss for anything unrecognised', () => {
    expect(announcementColours('nonsense')).toEqual(announcementColours('moss'));
  });

  it('reports the contrast between the text and the bar', () => {
    expect(announcementContrast('#000000')).toBeGreaterThan(15);
    // Mid grey is the worst case: neither text colour reaches AA.
    expect(announcementContrast('#808080')).toBeLessThan(7);
  });
});

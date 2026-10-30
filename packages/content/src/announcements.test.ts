import { describe, expect, it } from 'vitest';
import {
  type AnnouncementWindow,
  announcementClashes,
  announcementStatus,
  currentAnnouncement,
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

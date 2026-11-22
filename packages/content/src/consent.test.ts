import { describe, expect, it } from 'vitest';
import {
  ACCEPT_ALL,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  REJECT_ALL,
  allows,
  consentCookie,
  consentMaxAge,
  parseConsent,
  serialiseConsent,
  trackingCookiesToClear,
  lapsedCategories,
  withdrawnCategories,
  withdrawsConsent,
} from './consent';

const NOW = Date.UTC(2027, 0, 20);
const DAY = 24 * 60 * 60 * 1000;

const cookieFor = (value: string) => `${CONSENT_COOKIE}=${value}`;

describe('parseConsent', () => {
  it('reads back what was saved', () => {
    const saved = serialiseConsent({ analytics: true, marketing: false }, NOW - DAY);
    expect(parseConsent(`theme=dark; ${cookieFor(saved)}; other=1`, NOW)).toEqual({
      v: 1,
      analytics: true,
      marketing: false,
      at: NOW - DAY,
    });
  });

  it('is null when there is no cookie, so the visitor is asked', () => {
    expect(parseConsent('', NOW)).toBeNull();
    expect(parseConsent('theme=dark', NOW)).toBeNull();
  });

  it('ignores a cookie whose name only ends the same way', () => {
    const saved = serialiseConsent(ACCEPT_ALL, NOW);
    expect(parseConsent(`old_${cookieFor(saved)}`, NOW)).toBeNull();
  });

  it('is null for a value that is not a valid choice', () => {
    expect(parseConsent(cookieFor('not-json'), NOW)).toBeNull();
    expect(parseConsent(cookieFor('%E0%A4%A'), NOW)).toBeNull();
    expect(parseConsent(cookieFor(encodeURIComponent('null')), NOW)).toBeNull();
    expect(parseConsent(cookieFor(encodeURIComponent('"yes"')), NOW)).toBeNull();
    const wrongTypes = encodeURIComponent(
      JSON.stringify({ v: 1, analytics: 'yes', marketing: true, at: NOW })
    );
    expect(parseConsent(cookieFor(wrongTypes), NOW)).toBeNull();
  });

  it('asks again when the wording has changed', () => {
    const old = encodeURIComponent(
      JSON.stringify({ v: 0, analytics: true, marketing: true, at: NOW })
    );
    expect(parseConsent(cookieFor(old), NOW)).toBeNull();
  });

  it('asks again after a year, and distrusts a time in the future', () => {
    const lapsed = serialiseConsent(ACCEPT_ALL, NOW - CONSENT_MAX_AGE_SECONDS * 1000 - 1);
    expect(parseConsent(cookieFor(lapsed), NOW)).toBeNull();
    const almost = serialiseConsent(ACCEPT_ALL, NOW - CONSENT_MAX_AGE_SECONDS * 1000);
    expect(parseConsent(cookieFor(almost), NOW)).not.toBeNull();
    expect(parseConsent(cookieFor(serialiseConsent(ACCEPT_ALL, NOW + DAY)), NOW)).toBeNull();
  });
});

describe('consentCookie', () => {
  it('is first-party, site-wide and lasts a year', () => {
    const cookie = consentCookie(REJECT_ALL, NOW, true);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${CONSENT_MAX_AGE_SECONDS}`);
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(cookie).not.toContain('Domain=');
  });

  it('drops Secure on plain http, where the browser would refuse it', () => {
    expect(consentCookie(REJECT_ALL, NOW, false)).not.toContain('Secure');
  });

  it('round-trips through the parser', () => {
    const value = consentCookie(ACCEPT_ALL, NOW, true).split(';')[0]!;
    expect(parseConsent(value, NOW)).toMatchObject({ analytics: true, marketing: true });
  });
});

describe('allows', () => {
  it('is false for every category until the visitor has chosen', () => {
    expect(allows(null, 'analytics')).toBe(false);
    expect(allows(null, 'marketing')).toBe(false);
  });

  it('follows each category on its own', () => {
    const record = { v: 1, analytics: true, marketing: false, at: NOW };
    expect(allows(record, 'analytics')).toBe(true);
    expect(allows(record, 'marketing')).toBe(false);
  });
});

describe('withdrawnCategories', () => {
  const granted = { v: 1, ...ACCEPT_ALL, at: NOW };

  it('names only the categories a yes was taken back from', () => {
    expect(withdrawnCategories(granted, { analytics: true, marketing: false })).toEqual([
      'marketing',
    ]);
    expect(withdrawnCategories(granted, REJECT_ALL)).toEqual(['analytics', 'marketing']);
    expect(withdrawnCategories(granted, ACCEPT_ALL)).toEqual([]);
    expect(withdrawnCategories(null, REJECT_ALL)).toEqual([]);
  });
});

describe('trackingCookiesToClear', () => {
  const jar =
    'll_consent=x; ph_phc_abc_posthog=1; _ga=2; _ga_ABC123=3; _fbp=4; _gcl_au=5; theme=dark; session=6';

  it('finds the analytics tags’ cookies and leaves the rest', () => {
    expect(trackingCookiesToClear(jar, ['analytics'])).toEqual([
      'ph_phc_abc_posthog',
      '_ga',
      '_ga_ABC123',
    ]);
  });

  it('finds the marketing tags’ cookies', () => {
    expect(trackingCookiesToClear(jar, ['marketing'])).toEqual(['_fbp', '_gcl_au']);
  });

  it('never touches the consent cookie or the site’s own cookies', () => {
    const names = trackingCookiesToClear(jar, ['analytics', 'marketing']);
    expect(names).not.toContain('ll_consent');
    expect(names).not.toContain('theme');
    expect(names).not.toContain('session');
  });

  it('is empty for an empty jar or no categories', () => {
    expect(trackingCookiesToClear('', ['analytics'])).toEqual([]);
    expect(trackingCookiesToClear(jar, [])).toEqual([]);
  });
});

describe('withdrawsConsent', () => {
  const granted = { v: 1, ...ACCEPT_ALL, at: NOW };

  it('is true when a yes becomes a no', () => {
    expect(withdrawsConsent(granted, { analytics: true, marketing: false })).toBe(true);
    expect(withdrawsConsent(granted, REJECT_ALL)).toBe(true);
  });

  it('is false when nothing was taken back', () => {
    expect(withdrawsConsent(granted, ACCEPT_ALL)).toBe(false);
    expect(withdrawsConsent(null, REJECT_ALL)).toBe(false);
    expect(withdrawsConsent(null, ACCEPT_ALL)).toBe(false);
    const rejected = { v: 1, ...REJECT_ALL, at: NOW };
    expect(withdrawsConsent(rejected, ACCEPT_ALL)).toBe(false);
  });
});

describe('consent lifetime', () => {
  it('lasts the months an editor chose, and a year for anything else', () => {
    expect(consentMaxAge(12)).toBe(CONSENT_MAX_AGE_SECONDS);
    expect(consentMaxAge(6)).toBe(Math.round(CONSENT_MAX_AGE_SECONDS / 2));
    expect(consentMaxAge(3)).toBe(Math.round(CONSENT_MAX_AGE_SECONDS / 4));
    expect(consentMaxAge(60)).toBe(CONSENT_MAX_AGE_SECONDS);
    expect(consentMaxAge(0)).toBe(CONSENT_MAX_AGE_SECONDS);
  });

  it('sets the cookie to last that long', () => {
    expect(consentCookie(REJECT_ALL, NOW, true, 6)).toContain(`Max-Age=${consentMaxAge(6)}`);
  });

  it('asks again once the chosen lifetime has passed', () => {
    const saved = cookieFor(serialiseConsent(ACCEPT_ALL, NOW - 200 * DAY));
    expect(parseConsent(saved, NOW, 6)).toBeNull();
    expect(parseConsent(saved, NOW, 12)).not.toBeNull();
  });
});

describe('tags already running in a page', () => {
  const none = { v: 1, ...REJECT_ALL, at: NOW };

  it('still count as withdrawn when another tab already took the yes back', () => {
    // Tab B rejected, so the cookie tab A reads already says no; tab A's tags are still running.
    expect(withdrawnCategories(none, REJECT_ALL, ['analytics'])).toEqual(['analytics']);
    expect(withdrawnCategories(null, REJECT_ALL, ['analytics', 'marketing'])).toEqual([
      'analytics',
      'marketing',
    ]);
  });

  it('are not withdrawn while the choice still says yes', () => {
    expect(withdrawnCategories(none, ACCEPT_ALL, ['analytics'])).toEqual([]);
    expect(withdrawnCategories(none, { analytics: true, marketing: false }, ['analytics'])).toEqual(
      []
    );
  });

  it('are named once, even when the old choice and the running tags both point at them', () => {
    const granted = { v: 1, ...ACCEPT_ALL, at: NOW };
    expect(withdrawnCategories(granted, REJECT_ALL, ['analytics'])).toEqual([
      'analytics',
      'marketing',
    ]);
  });

  it('lapse when the saved choice no longer allows them', () => {
    const analyticsOnly = { v: 1, analytics: true, marketing: false, at: NOW };
    expect(lapsedCategories(['analytics', 'marketing'], analyticsOnly)).toEqual(['marketing']);
    expect(lapsedCategories(['analytics'], null)).toEqual(['analytics']);
    expect(lapsedCategories(['analytics'], { v: 1, ...ACCEPT_ALL, at: NOW })).toEqual([]);
    expect(lapsedCategories([], null)).toEqual([]);
  });
});

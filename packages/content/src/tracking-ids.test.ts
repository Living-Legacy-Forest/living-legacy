import { describe, expect, it } from 'vitest';
import { SITE_SETTINGS_DEFAULTS } from './settings';
import { TRACKING_ID_KEYS, parseGaIds, pickTrackingIds, trackingIdsProblem } from './tracking-ids';

const none = { gtmId: '', metaPixelId: '', gaMeasurementIds: '', posthogKey: '' };

describe('parseGaIds', () => {
  it('splits on commas and spaces, tidies case and drops repeats', () => {
    expect(parseGaIds(' g-abc123xyz, AW-123456789  G-ABC123XYZ ,')).toEqual([
      'G-ABC123XYZ',
      'AW-123456789',
    ]);
    expect(parseGaIds('')).toEqual([]);
  });
});

describe('trackingIdsProblem', () => {
  it('accepts blank ids and well-formed ones', () => {
    expect(trackingIdsProblem(none)).toBeNull();
    expect(
      trackingIdsProblem({
        gtmId: 'GTM-ABC1234',
        metaPixelId: '1234567890123',
        gaMeasurementIds: 'G-ABC123XYZ, AW-123456789',
        posthogKey: 'phc_abcdefghijklmnopqrstuvwxyz',
      })
    ).toBeNull();
  });

  it('names the id that is wrong', () => {
    expect(trackingIdsProblem({ ...none, gtmId: 'GTM' })).toMatch(/Tag Manager/);
    expect(trackingIdsProblem({ ...none, gtmId: 'gtm-abc1234' })).toMatch(/Tag Manager/);
    expect(trackingIdsProblem({ ...none, metaPixelId: '12ab' })).toMatch(/Meta pixel/);
    expect(trackingIdsProblem({ ...none, gaMeasurementIds: 'G-ABC123XYZ, nope' })).toMatch(
      /"NOPE"/
    );
    expect(trackingIdsProblem({ ...none, posthogKey: 'sk_secret' })).toMatch(/PostHog/);
  });
});

describe('TRACKING_ID_KEYS', () => {
  it('are all real settings, so a rename cannot leave one behind', () => {
    for (const key of TRACKING_ID_KEYS) expect(SITE_SETTINGS_DEFAULTS).toHaveProperty(key);
    expect(new Set(TRACKING_ID_KEYS).size).toBe(Object.keys(none).length);
  });
});

describe('pickTrackingIds', () => {
  it('returns exactly the tracking keys', () => {
    const picked = pickTrackingIds({ ...SITE_SETTINGS_DEFAULTS, gtmId: 'GTM-ABC1234' });
    expect(Object.keys(picked).sort()).toEqual([...TRACKING_ID_KEYS].sort());
    expect(picked.gtmId).toBe('GTM-ABC1234');
  });
});

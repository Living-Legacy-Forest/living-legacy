import { describe, expect, it } from 'vitest';
import { defaultPasskeyName, passkeysAllowed, shouldOfferPasskey } from './passkeys';

const PROD = 'https://cms.livinglegacy.com.au';
const days = (n: number) => n * 86_400_000;

describe('passkeysAllowed', () => {
  it('is on for a deployed build on the CMS address', () => {
    expect(passkeysAllowed({ dev: false, requestUrl: `${PROD}/login`, authUrl: PROD })).toBe(true);
  });

  it('is off in local dev', () => {
    expect(passkeysAllowed({ dev: true, requestUrl: `${PROD}/login`, authUrl: PROD })).toBe(false);
    expect(
      passkeysAllowed({
        dev: true,
        requestUrl: 'http://localhost:3100/login',
        authUrl: 'http://localhost:3100',
      })
    ).toBe(false);
  });

  it('is off on a preview address', () => {
    expect(
      passkeysAllowed({
        dev: false,
        requestUrl: 'https://abc123-living-legacy-cms.example.workers.dev/login',
        authUrl: PROD,
      })
    ).toBe(false);
  });

  it('is off when the request address cannot be read', () => {
    expect(passkeysAllowed({ dev: false, requestUrl: '', authUrl: PROD })).toBe(false);
  });
});

describe('shouldOfferPasskey', () => {
  const now = Date.UTC(2026, 10, 23);
  const base = { supported: true, passkeyCount: 0, dismissedAt: null, now };

  it('offers one to someone with none who has not said not now', () => {
    expect(shouldOfferPasskey(base)).toBe(true);
  });

  it('never offers one where the browser cannot use them', () => {
    expect(shouldOfferPasskey({ ...base, supported: false })).toBe(false);
  });

  it('never offers one to someone who has one', () => {
    expect(shouldOfferPasskey({ ...base, passkeyCount: 1 })).toBe(false);
  });

  it('stays quiet when it could not find out whether they have one', () => {
    expect(shouldOfferPasskey({ ...base, passkeyCount: null })).toBe(false);
  });

  it('stays quiet for 30 days after not now', () => {
    expect(shouldOfferPasskey({ ...base, dismissedAt: now - days(29) })).toBe(false);
    expect(shouldOfferPasskey({ ...base, dismissedAt: now - days(31) })).toBe(true);
  });
});

describe('defaultPasskeyName', () => {
  it('names the device it was made on', () => {
    expect(
      defaultPasskeyName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1'
      )
    ).toBe('iPhone');
    expect(
      defaultPasskeyName(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      )
    ).toBe('Mac');
    expect(
      defaultPasskeyName(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      )
    ).toBe('Windows PC');
    expect(
      defaultPasskeyName(
        'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'
      )
    ).toBe('Android phone');
  });

  it('falls back to a plain name', () => {
    expect(defaultPasskeyName('SomethingElse/1.0')).toBe('This device');
  });
});

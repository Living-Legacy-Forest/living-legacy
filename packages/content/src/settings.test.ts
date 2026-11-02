import { describe, expect, it } from 'vitest';
import { SITE_SETTINGS_DEFAULTS, formatPageTitle, parseSiteSettings, telHref } from './settings';

describe('parseSiteSettings', () => {
  it('fills missing keys from the defaults', () => {
    expect(parseSiteSettings({ phone: '1300 000 000' })).toEqual({
      ...SITE_SETTINGS_DEFAULTS,
      phone: '1300 000 000',
    });
  });

  it('drops unknown keys and values of the wrong type', () => {
    const settings = parseSiteSettings({ phone: 42, retired: 'x' });
    expect(settings.phone).toBe('');
    expect(settings).not.toHaveProperty('retired');
  });

  it('treats a missing row as the defaults', () => {
    expect(parseSiteSettings(undefined)).toEqual(SITE_SETTINGS_DEFAULTS);
  });
});

describe('formatPageTitle', () => {
  it('fills both tokens', () => {
    expect(formatPageTitle('{page} | {site}', 'Contact', 'Acme')).toBe('Contact | Acme');
  });

  it('falls back to the default pattern when blank', () => {
    expect(formatPageTitle('', 'Contact', 'Acme')).toBe('Contact | Acme');
  });

  it('uses the site title alone when there is no page title', () => {
    expect(formatPageTitle('{page} | {site}', '', 'Acme')).toBe('Acme');
  });
});

describe('telHref', () => {
  it('strips spaces and punctuation', () => {
    expect(telHref('(03) 7019 6142')).toBe('tel:0370196142');
  });

  it('keeps a leading plus', () => {
    expect(telHref('+61 3 7019 6142')).toBe('tel:+61370196142');
  });
});

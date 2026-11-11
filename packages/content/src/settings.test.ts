import { describe, expect, it } from 'vitest';
import { BRAND_RULES } from './brand-language';
import {
  contentTargetProblem,
  contentTargetsFrom,
  SITE_SETTINGS_DEFAULTS,
  formatPageTitle,
  isEmailDomain,
  isEmailDomainAllowed,
  parseEmailDomains,
  parseSiteSettings,
  telHref,
  siteIconProblem,
} from './settings';

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

describe('email domains', () => {
  it('parses a loose list into clean, unique domains', () => {
    expect(
      parseEmailDomains(' Living-Legacy.com.au, @sistercreatives.co;living-legacy.com.au ')
    ).toEqual(['living-legacy.com.au', 'sistercreatives.co']);
    expect(parseEmailDomains('')).toEqual([]);
  });

  it('checks the shape of a domain', () => {
    expect(isEmailDomain('example.com.au')).toBe(true);
    expect(isEmailDomain('sister-creatives.co')).toBe(true);
    expect(isEmailDomain('localhost')).toBe(false);
    expect(isEmailDomain('-bad.com')).toBe(false);
    expect(isEmailDomain('name@example.com')).toBe(false);
  });

  it('allows any address when no domains are set', () => {
    expect(isEmailDomainAllowed('a@anywhere.org', '')).toBe(true);
  });

  it('allows only the listed domains, ignoring case', () => {
    expect(isEmailDomainAllowed('Jo@Example.com', 'example.com, other.org')).toBe(true);
    expect(isEmailDomainAllowed('jo@sub.example.com', 'example.com')).toBe(false);
    expect(isEmailDomainAllowed('jo@elsewhere.com', 'example.com')).toBe(false);
  });
});

describe('content targets', () => {
  it('default to the spec ranges when nothing is saved', () => {
    expect(contentTargetsFrom(parseSiteSettings(undefined))).toEqual({
      targetWordsMin: 600,
      targetWordsMax: 2000,
      targetHeadingsMin: 3,
      targetHeadingsMax: 12,
      targetParagraphsMin: 5,
      targetImagesMin: 1,
      targetImagesMax: 8,
      targetFocusKeywordUses: 2,
      targetRelatedTermUses: 1,
      brandRules: [...BRAND_RULES],
    });
  });

  it('keep saved numbers and ignore values of the wrong type', () => {
    const targets = contentTargetsFrom(
      parseSiteSettings({ targetWordsMin: 300, targetWordsMax: '900' })
    );
    expect(targets.targetWordsMin).toBe(300);
    expect(targets.targetWordsMax).toBe(2000);
  });

  it('report a minimum above its maximum', () => {
    const targets = contentTargetsFrom(parseSiteSettings(undefined));
    expect(contentTargetProblem(targets)).toBeNull();
    expect(contentTargetProblem({ ...targets, targetImagesMin: 9 })).toBe(
      'Images: the lowest target is above the highest.'
    );
  });
});

describe('siteIconProblem', () => {
  it('accepts a square image of at least 512 pixels', () => {
    expect(siteIconProblem({ width: 512, height: 512 })).toBeNull();
    expect(siteIconProblem({ width: 1024, height: 1024 })).toBeNull();
  });

  it('refuses an image that is not square', () => {
    expect(siteIconProblem({ width: 800, height: 600 })).toBe(
      'The site icon must be square. This image is 800 by 600 pixels.'
    );
  });

  it('refuses a small image', () => {
    expect(siteIconProblem({ width: 256, height: 256 })).toBe(
      'The site icon must be at least 512 by 512 pixels. This image is 256 by 256.'
    );
  });

  it('refuses an image whose size is unknown', () => {
    expect(siteIconProblem({ width: null, height: null })).toBe(
      'That image could not be measured. Upload it again as a PNG.'
    );
  });
});

describe('brand rules in settings', () => {
  it('start as the guide list and keep a valid edited one', () => {
    expect(parseSiteSettings({}).brandRules).toEqual([...BRAND_RULES]);
    const edited = [{ match: 'cheap', instead: 'affordable', severity: 'warning' }];
    expect(parseSiteSettings({ brandRules: edited }).brandRules).toEqual(edited);
  });

  it('fall back to the guide list when the stored one is broken', () => {
    expect(parseSiteSettings({ brandRules: [{ match: 1 }] }).brandRules).toEqual([...BRAND_RULES]);
    expect(parseSiteSettings({ brandRules: { plot: true } }).brandRules).toEqual([...BRAND_RULES]);
  });

  it('travel with the content targets to the score', () => {
    const edited = [{ match: 'cheap', instead: 'affordable', severity: 'critical' as const }];
    const targets = contentTargetsFrom(parseSiteSettings({ brandRules: edited }));
    expect(targets.brandRules).toEqual(edited);
  });
});

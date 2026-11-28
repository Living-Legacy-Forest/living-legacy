import { describe, expect, it } from 'vitest';
import {
  canOpenSection,
  isSettingsItemActive,
  isSettingsPath,
  isSettingsSectionId,
  settingsNavFor,
  settingsPageTitle,
} from './settings-nav';

const pagesFor = (role: 'admin' | 'seo' | 'viewer' | 'editor' | 'author') =>
  settingsNavFor({ role }).flatMap((group) => group.items.map((item) => item.to));

describe('settings nav', () => {
  it('gives an admin every page, with the moved admin pages included', () => {
    const pages = pagesFor('admin');
    for (const to of [
      '/profile',
      '/profile/appearance',
      '/profile/security',
      '/settings/general',
      '/settings/brand-language',
      '/users',
      '/integrations',
      '/integrations/apps',
      '/system',
      '/uptime',
    ]) {
      expect(pages).toContain(to);
    }
  });

  it('gives an SEO person their own pages and the three they can edit', () => {
    const pages = pagesFor('seo');
    expect(pages).toContain('/profile');
    expect(pages).toContain('/settings/search');
    expect(pages).toContain('/settings/content-targets');
    expect(pages).toContain('/settings/brand-language');
    expect(pages).not.toContain('/settings/general');
    expect(pages).not.toContain('/users');
    expect(pages).not.toContain('/system');
  });

  it('gives everyone else only their own pages', () => {
    expect(pagesFor('viewer')).toEqual(['/profile', '/profile/appearance', '/profile/security']);
  });

  it('checks a settings page against its permission', () => {
    expect(canOpenSection({ role: 'admin' }, 'general')).toBe(true);
    expect(canOpenSection({ role: 'seo' }, 'general')).toBe(false);
    expect(canOpenSection({ role: 'seo' }, 'search')).toBe(true);
  });

  it('only accepts the known section addresses', () => {
    expect(isSettingsSectionId('cookies')).toBe(true);
    expect(isSettingsSectionId('nonsense')).toBe(false);
  });
});

describe('where Settings is', () => {
  it('counts the settings pages and the pages moved into it', () => {
    for (const path of [
      '/settings',
      '/settings/general',
      '/profile',
      '/profile/security',
      '/users',
      '/integrations',
      '/integrations/apps',
      '/system',
      '/uptime',
      '/legal/privacy',
    ]) {
      expect(isSettingsPath(path)).toBe(true);
    }
  });

  it('leaves the rest of the app out', () => {
    for (const path of ['/', '/posts', '/activity', '/redirects', '/events/overview']) {
      expect(isSettingsPath(path)).toBe(false);
    }
  });

  it('marks the legal page as open while its editor is', () => {
    expect(isSettingsItemActive('/settings/legal', '/legal/privacy')).toBe(true);
    expect(isSettingsItemActive('/settings/general', '/legal/privacy')).toBe(false);
  });

  it('names the page for the breadcrumb', () => {
    expect(settingsPageTitle('/settings/brand-language')).toBe('Brand language');
    expect(settingsPageTitle('/users')).toBe('Users');
    expect(settingsPageTitle('/legal/privacy')).toBe('Legal');
    expect(settingsPageTitle('/settings')).toBeUndefined();
  });
});

import type { Access } from '@ll/content';
import { describe, expect, it } from 'vitest';
import {
  editorBack,
  findNavItem,
  isEditorPath,
  isNavItemAllowed,
  isTabActive,
  navGroups,
  sidebarSections,
} from './nav';

const items = navGroups.flatMap((g) => g.items);
const visibleTo = (access: Access) =>
  items.filter((item) => isNavItemAllowed(item, access)).map((item) => item.title);

describe('isNavItemAllowed', () => {
  it('shows admins everything', () => {
    expect(visibleTo({ role: 'admin' })).toEqual(items.map((item) => item.title));
  });

  it('hides management pages from viewers', () => {
    const viewer = visibleTo({ role: 'viewer' });
    expect(viewer).toContain('Posts');
    for (const hidden of ['Media', 'Users', 'Integrations', 'Redirects', 'Settings', 'Activity']) {
      expect(viewer).not.toContain(hidden);
    }
  });

  it('shows an item when the role has any one of its permissions', () => {
    // Settings needs settings:write or seo:write; the SEO role has only the second.
    expect(visibleTo({ role: 'seo' })).toContain('Settings');
    expect(visibleTo({ role: 'seo' })).not.toContain('Users');
  });

  describe('with extra permissions', () => {
    const redirects = items.find((item) => item.to === '/redirects')!;

    it('hides Redirects from an author', () => {
      expect(isNavItemAllowed(redirects, { role: 'author' })).toBe(false);
    });

    it('shows Redirects to an author who was given redirects:write', () => {
      expect(
        isNavItemAllowed(redirects, { role: 'author', extraPermissions: ['redirects:write'] })
      ).toBe(true);
    });
  });
});

describe('sidebarSections', () => {
  const pagesFor = (access: Access) =>
    sidebarSections(access).flatMap((section) => section.pages.map((page) => page.to));

  it('leaves Redirects out for an author', () => {
    expect(pagesFor({ role: 'author' })).not.toContain('/redirects');
  });

  it('lists Redirects for an author who was given redirects:write', () => {
    expect(pagesFor({ role: 'author', extraPermissions: ['redirects:write'] })).toContain(
      '/redirects'
    );
  });
});

describe('Integrations', () => {
  const pagesFor = (access: Access) =>
    sidebarSections(access).flatMap((section) => section.pages.map((page) => page.to));

  it('has API keys and Apps in Settings, not in the app sidebar', () => {
    const pages = pagesFor({ role: 'admin' });
    expect(pages).not.toContain('/integrations');
    expect(pages).not.toContain('/integrations/apps');
  });

  it('names each page in the header', () => {
    expect(findNavItem('/integrations')?.title).toBe('API keys');
    expect(findNavItem('/integrations/apps')?.title).toBe('Apps');
  });
});

describe('findNavItem', () => {
  it('matches a page exactly', () => {
    expect(findNavItem('/posts/categories')?.title).toBe('Categories');
    expect(findNavItem('/events/overview')?.title).toBe('Overview');
  });

  it('falls back to the closest parent', () => {
    expect(findNavItem('/posts/01J0ABC')?.title).toBe('All posts');
    expect(findNavItem('/events/01J0ABC/guests')?.title).toBe('All events');
  });

  it('knows pages that have no sidebar entry', () => {
    expect(findNavItem('/profile')?.title).toBe('Profile');
  });

  it('never matches the dashboard as a parent', () => {
    expect(findNavItem('/nowhere')).toBeUndefined();
  });
});

describe('phone tabs', () => {
  it('marks a section active on its pages only', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/', '/posts')).toBe(false);
    expect(isTabActive('/posts', '/posts/abc')).toBe(true);
    expect(isTabActive('/posts', '/postscript')).toBe(false);
  });

  it('treats a post, but not the term lists, as the full-screen editor', () => {
    expect(isEditorPath('/posts/01J0ABC')).toBe(true);
    expect(isEditorPath('/posts/new')).toBe(true);
    expect(isEditorPath('/posts/categories')).toBe(false);
    expect(isEditorPath('/posts')).toBe(false);
  });

  it('treats a media file, but not the library, as its own full-screen page', () => {
    expect(isEditorPath('/media/01J0ABC')).toBe(true);
    expect(isEditorPath('/media')).toBe(false);
    expect(editorBack('/media/01J0ABC')).toEqual({ to: '/media', label: 'Media' });
  });

  it('treats an event, but not the events list or overview, as the full-screen editor', () => {
    expect(isEditorPath('/events/01J0ABC')).toBe(true);
    expect(isEditorPath('/events/new')).toBe(true);
    expect(isEditorPath('/events')).toBe(false);
    expect(isEditorPath('/events/overview')).toBe(false);
  });

  it('treats a location, but not the locations list, as the full-screen editor', () => {
    expect(isEditorPath('/locations/01J0ABC')).toBe(true);
    expect(isEditorPath('/locations/new')).toBe(true);
    expect(isEditorPath('/locations')).toBe(false);
  });
});

describe('editorBack', () => {
  it('goes back to the list the editor was opened from', () => {
    expect(editorBack('/events/01J0ABC')).toEqual({ to: '/events', label: 'Events' });
    expect(editorBack('/locations/01J0ABC')).toEqual({ to: '/locations', label: 'Locations' });
    expect(editorBack('/posts/01J0ABC')).toEqual({ to: '/posts', label: 'Posts' });
    expect(editorBack('/media')).toBeNull();
  });

  it('keeps an event page under All events in the sidebar', () => {
    expect(findNavItem('/events/01J0ABC')?.title).toBe('All events');
    expect(findNavItem('/locations/01J0ABC')?.title).toBe('Locations');
  });
});

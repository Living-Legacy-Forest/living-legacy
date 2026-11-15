import type { Role } from '@ll/content';
import { describe, expect, it } from 'vitest';
import {
  editorBack,
  findNavItem,
  isEditorPath,
  isNavItemAllowed,
  isTabActive,
  navGroups,
} from './nav';

const items = navGroups.flatMap((g) => g.items);
const visibleTo = (role: Role) =>
  items.filter((item) => isNavItemAllowed(item, role)).map((item) => item.title);

describe('isNavItemAllowed', () => {
  it('shows admins everything', () => {
    expect(visibleTo('admin')).toEqual(items.map((item) => item.title));
  });

  it('hides management pages from viewers', () => {
    const viewer = visibleTo('viewer');
    expect(viewer).toContain('Posts');
    for (const hidden of ['Media', 'Users', 'Integrations', 'Redirects', 'Settings', 'Activity']) {
      expect(viewer).not.toContain(hidden);
    }
  });

  it('shows an item when the role has any one of its permissions', () => {
    // Settings needs settings:write or seo:write; the SEO role has only the second.
    expect(visibleTo('seo')).toContain('Settings');
    expect(visibleTo('seo')).not.toContain('Users');
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

  it('treats an event, but not the events list or overview, as the full-screen editor', () => {
    expect(isEditorPath('/events/01J0ABC')).toBe(true);
    expect(isEditorPath('/events/new')).toBe(true);
    expect(isEditorPath('/events')).toBe(false);
    expect(isEditorPath('/events/overview')).toBe(false);
  });
});

describe('editorBack', () => {
  it('goes back to the list the editor was opened from', () => {
    expect(editorBack('/events/01J0ABC')).toEqual({ to: '/events', label: 'Events' });
    expect(editorBack('/posts/01J0ABC')).toEqual({ to: '/posts', label: 'Posts' });
    expect(editorBack('/media')).toBeNull();
  });

  it('keeps an event page under All events in the sidebar', () => {
    expect(findNavItem('/events/01J0ABC')?.title).toBe('All events');
  });
});

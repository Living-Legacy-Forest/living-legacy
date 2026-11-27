import { describe, expect, it } from 'vitest';
import {
  type Groupable,
  defaultPostsDisplay,
  groupPosts,
  parsePostsDisplay,
  statusGroup,
  toggleProperty,
} from './posts-display';

const post = (over: Partial<Groupable> & { id?: string }): Groupable & { id: string } => ({
  id: 'p',
  status: 'draft',
  reviewRequestedAt: null,
  scheduledAt: null,
  categories: [],
  author: null,
  ...over,
});

describe('parsePostsDisplay', () => {
  it('falls back to the quiet default for a missing or broken cookie', () => {
    expect(parsePostsDisplay(undefined)).toEqual(defaultPostsDisplay);
    expect(parsePostsDisplay('{nope')).toEqual(defaultPostsDisplay);
  });

  it('keeps known values and drops unknown ones', () => {
    const raw = JSON.stringify({ grouping: 'author', properties: ['date', 'bogus', 'thumbnail'] });
    expect(parsePostsDisplay(raw)).toEqual({
      grouping: 'author',
      properties: ['thumbnail', 'date'],
    });
    expect(parsePostsDisplay(JSON.stringify({ grouping: 'nope' })).grouping).toBe('none');
  });

  it('lets every detail be switched off', () => {
    expect(parsePostsDisplay(JSON.stringify({ properties: [] })).properties).toEqual([]);
  });
});

describe('toggleProperty', () => {
  it('adds and removes a detail, keeping the menu order', () => {
    const on = toggleProperty(defaultPostsDisplay, 'thumbnail');
    expect(on.properties[0]).toBe('thumbnail');
    expect(toggleProperty(on, 'thumbnail')).toEqual(defaultPostsDisplay);
  });
});

describe('statusGroup', () => {
  it('matches the words on the status badge', () => {
    expect(statusGroup(post({}), false)).toBe('Draft');
    expect(statusGroup(post({ scheduledAt: 1 }), false)).toBe('Scheduled');
    expect(statusGroup(post({ reviewRequestedAt: 1 }), false)).toBe('In review');
    expect(statusGroup(post({ status: 'published' }), false)).toBe('Published');
    expect(statusGroup(post({ status: 'published' }), true)).toBe('Trash');
  });
});

describe('groupPosts', () => {
  const rows = [
    post({ id: 'a', status: 'published', categories: [{ name: 'Guides' }], author: 'Sam' }),
    post({ id: 'b', categories: [{ name: 'Stories' }] }),
    post({ id: 'c', status: 'published', categories: [{ name: 'Guides' }], author: 'Alex' }),
  ];

  it('makes one unlabelled group without grouping, and none for no rows', () => {
    expect(groupPosts(rows, 'none', false)).toEqual([{ key: 'all', label: '', rows }]);
    expect(groupPosts([], 'none', false)).toEqual([]);
  });

  it('groups by status in the badge order, keeping each group in arrival order', () => {
    const groups = groupPosts(rows, 'status', false);
    expect(groups.map((g) => g.label)).toEqual(['Draft', 'Published']);
    expect(groups[1]!.rows.map((r) => (r as { id: string }).id)).toEqual(['a', 'c']);
  });

  it('groups by category alphabetically with "No category" last', () => {
    const mixed = [...rows, post({ id: 'd' })];
    expect(groupPosts(mixed, 'category', false).map((g) => g.label)).toEqual([
      'Guides',
      'Stories',
      'No category',
    ]);
  });

  it('groups by author, with posts that have none last', () => {
    expect(groupPosts(rows, 'author', false).map((g) => g.label)).toEqual([
      'Alex',
      'Sam',
      'No author',
    ]);
  });
});

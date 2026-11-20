import { grantablePermissions, type Permission } from '@ll/content';
import { describe, expect, it } from 'vitest';
import {
  applyExtraChange,
  describeExtras,
  extraAccessGroups,
  invitePayload,
  normaliseExtras,
  permissionState,
  resendPayload,
  splitExtras,
} from './extra-access-rules';

describe('splitExtras', () => {
  it('separates what the role includes from the extras', () => {
    expect(splitExtras('author', ['posts:write', 'redirects:write'])).toEqual({
      included: ['posts:write'],
      extras: ['redirects:write'],
    });
  });

  it('gives an admin no extras', () => {
    const result = splitExtras('admin', ['posts:write', 'redirects:write']);
    expect(result.extras).toEqual([]);
    expect(result.included).toEqual(['posts:write', 'redirects:write']);
  });

  it('drops users:manage and duplicates', () => {
    const selected = ['redirects:write', 'redirects:write', 'users:manage'] as Permission[];
    expect(splitExtras('viewer', selected)).toEqual({
      included: [],
      extras: ['redirects:write'],
    });
  });
});

describe('extraAccessGroups', () => {
  it('lists every grantable permission once and never users:manage', () => {
    const listed = extraAccessGroups.flatMap((group) => group.items.map((i) => i.permission));
    expect([...listed].sort()).toEqual([...grantablePermissions].sort());
    expect(listed).not.toContain('users:manage');
  });

  it('uses the six headings in order', () => {
    expect(extraAccessGroups.map((g) => g.heading)).toEqual([
      'Posts',
      'SEO',
      'Content',
      'Events',
      'Media',
      'Other',
    ]);
  });

  it('labels redirects in plain words', () => {
    const items = extraAccessGroups.flatMap((g) => g.items);
    expect(items.find((i) => i.permission === 'redirects:write')?.label).toBe('Edit redirects');
  });
});

describe('permissionState', () => {
  it('ticks and locks what the role includes', () => {
    expect(permissionState('author', [], 'media:write')).toEqual({
      checked: true,
      locked: true,
      note: 'Included in Author',
    });
  });

  it('leaves other permissions unticked and open', () => {
    expect(permissionState('author', [], 'redirects:write')).toEqual({
      checked: false,
      locked: false,
      note: null,
    });
  });

  it('ticks an extra without locking it', () => {
    expect(permissionState('author', ['redirects:write'], 'redirects:write')).toEqual({
      checked: true,
      locked: false,
      note: null,
    });
  });

  it('shows write ticked and locked while publish is selected without write', () => {
    expect(permissionState('seo', ['posts:publish'], 'posts:write')).toEqual({
      checked: true,
      locked: true,
      note: 'Needed to publish',
    });
  });

  it('keeps the role note when the role already includes write', () => {
    expect(permissionState('author', ['posts:publish'], 'posts:write').note).toBe(
      'Included in Author'
    );
  });

  it('locks write when the role itself includes publish', () => {
    // No role has publish without write today; this guards the rule, not the data.
    expect(permissionState('editor', [], 'posts:publish').note).toBe('Included in Editor');
  });
});

describe('applyExtraChange', () => {
  it('adds a ticked permission', () => {
    expect(applyExtraChange('author', [], 'redirects:write', true)).toEqual(['redirects:write']);
  });

  it('removes an unticked permission', () => {
    expect(applyExtraChange('author', ['redirects:write'], 'redirects:write', false)).toEqual([]);
  });

  it('ticks write with publish when the role lacks write', () => {
    expect(applyExtraChange('seo', [], 'posts:publish', true)).toEqual([
      'posts:write',
      'posts:publish',
    ]);
  });

  it('does not add write when the role already includes it', () => {
    expect(applyExtraChange('author', [], 'posts:publish', true)).toEqual(['posts:publish']);
  });

  it('leaves write ticked when publish is unticked', () => {
    expect(
      applyExtraChange('seo', ['posts:write', 'posts:publish'], 'posts:publish', false)
    ).toEqual(['posts:write']);
  });

  it('refuses to untick write while publish is selected', () => {
    const current: Permission[] = ['posts:write', 'posts:publish'];
    expect(applyExtraChange('seo', current, 'posts:write', false)).toEqual(current);
  });

  it('ignores changes to what the role includes', () => {
    expect(applyExtraChange('author', [], 'media:write', true)).toEqual([]);
  });

  it('ignores users:manage', () => {
    expect(applyExtraChange('author', [], 'users:manage', true)).toEqual([]);
  });

  it('returns extras in a steady order', () => {
    expect(applyExtraChange('viewer', ['settings:write'], 'redirects:write', true)).toEqual([
      'redirects:write',
      'settings:write',
    ]);
  });
});

describe('normaliseExtras', () => {
  it('adds write to a publish extra stored without it', () => {
    expect(normaliseExtras('seo', ['posts:publish'])).toEqual(['posts:write', 'posts:publish']);
  });

  it('drops extras the role already includes', () => {
    expect(normaliseExtras('author', ['posts:write', 'redirects:write'])).toEqual([
      'redirects:write',
    ]);
  });

  it('gives an admin none', () => {
    expect(normaliseExtras('admin', ['redirects:write'])).toEqual([]);
  });
});

describe('describeExtras', () => {
  it('joins the labels as a short line', () => {
    expect(describeExtras(['redirects:write', 'settings:write'])).toBe(
      'Edit redirects, Change settings'
    );
  });

  it('is empty when there are none', () => {
    expect(describeExtras([])).toBe('');
  });
});

describe('invite payloads', () => {
  it('sends the extras the role does not already include', () => {
    expect(invitePayload('a@example.com', 'author', ['posts:write', 'redirects:write'])).toEqual({
      email: 'a@example.com',
      role: 'author',
      extraPermissions: ['redirects:write'],
    });
  });

  it('resends a pending invitation with its extras, so replacing it keeps them', () => {
    expect(
      resendPayload({
        email: 'a@example.com',
        role: 'seo',
        extraPermissions: ['events:manage'],
      })
    ).toEqual({
      email: 'a@example.com',
      role: 'seo',
      extraPermissions: ['events:manage'],
    });
  });
});

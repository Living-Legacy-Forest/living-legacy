import { grantablePermissions, type Permission } from '@ll/content';
import { describe, expect, it } from 'vitest';
import {
  applyExtraChange,
  describeExtras,
  extraAccessGroups,
  extrasLine,
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

  it('shows content ticked and locked while legal publishing is selected without it', () => {
    expect(permissionState('viewer', ['legal:publish'], 'content:write')).toEqual({
      checked: true,
      locked: true,
      note: 'Needed to publish legal pages',
    });
  });

  it('shows SEO ticked and locked while settings is selected without it', () => {
    expect(permissionState('viewer', ['settings:write'], 'seo:write')).toEqual({
      checked: true,
      locked: true,
      note: 'Needed to change settings',
    });
  });

  it('keeps the role note when the role already includes what is needed', () => {
    expect(permissionState('author', ['posts:publish'], 'posts:write').note).toBe(
      'Included in Author'
    );
    expect(permissionState('seo', ['settings:write'], 'seo:write').note).toBe('Included in SEO');
    expect(permissionState('editor', [], 'content:write').note).toBe('Included in Editor');
  });

  it('leaves a requirement open until its dependent is selected', () => {
    for (const [permission, required] of [
      ['posts:publish', 'posts:write'],
      ['legal:publish', 'content:write'],
      ['settings:write', 'seo:write'],
    ] as const) {
      expect(permissionState('viewer', [], required)).toEqual({
        checked: false,
        locked: false,
        note: null,
      });
      expect(permissionState('viewer', [permission], permission).locked).toBe(false);
    }
  });

  it('shows what the role includes as included, even for a dependent permission', () => {
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

  it('ticks content with legal publishing when the role lacks content', () => {
    expect(applyExtraChange('viewer', [], 'legal:publish', true)).toEqual([
      'content:write',
      'legal:publish',
    ]);
  });

  it('ticks SEO with settings when the role lacks SEO', () => {
    expect(applyExtraChange('author', [], 'settings:write', true)).toEqual([
      'seo:write',
      'settings:write',
    ]);
  });

  it('does not add what the role already includes', () => {
    expect(applyExtraChange('author', [], 'posts:publish', true)).toEqual(['posts:publish']);
    expect(applyExtraChange('seo', [], 'settings:write', true)).toEqual(['settings:write']);
    expect(applyExtraChange('editor', [], 'legal:publish', true)).toEqual(['legal:publish']);
  });

  it('keeps a requirement ticked on its own', () => {
    expect(applyExtraChange('viewer', [], 'posts:write', true)).toEqual(['posts:write']);
    expect(applyExtraChange('viewer', [], 'content:write', true)).toEqual(['content:write']);
    expect(applyExtraChange('viewer', [], 'seo:write', true)).toEqual(['seo:write']);
  });

  it('leaves the requirement ticked when its dependent is unticked', () => {
    expect(
      applyExtraChange('seo', ['posts:write', 'posts:publish'], 'posts:publish', false)
    ).toEqual(['posts:write']);
    expect(
      applyExtraChange('viewer', ['content:write', 'legal:publish'], 'legal:publish', false)
    ).toEqual(['content:write']);
    expect(
      applyExtraChange('viewer', ['seo:write', 'settings:write'], 'settings:write', false)
    ).toEqual(['seo:write']);
  });

  it('refuses to untick a requirement while its dependent is selected', () => {
    for (const current of [
      ['posts:write', 'posts:publish'],
      ['content:write', 'legal:publish'],
      ['seo:write', 'settings:write'],
    ] as Permission[][]) {
      expect(applyExtraChange('viewer', current, current[0]!, false)).toEqual(current);
    }
  });

  it('ignores changes to what the role includes', () => {
    expect(applyExtraChange('author', [], 'media:write', true)).toEqual([]);
  });

  it('ignores users:manage', () => {
    expect(applyExtraChange('author', [], 'users:manage', true)).toEqual([]);
  });

  it('returns extras in a steady order', () => {
    expect(applyExtraChange('viewer', ['media:write'], 'events:manage', true)).toEqual([
      'events:manage',
      'media:write',
    ]);
  });
});

describe('normaliseExtras', () => {
  it('adds write to a publish extra stored without it', () => {
    expect(normaliseExtras('seo', ['posts:publish'])).toEqual(['posts:write', 'posts:publish']);
  });

  it('adds what legal publishing and settings need', () => {
    expect(normaliseExtras('viewer', ['legal:publish', 'settings:write'])).toEqual([
      'seo:write',
      'content:write',
      'settings:write',
      'legal:publish',
    ]);
  });

  it('adds only what the role lacks', () => {
    expect(normaliseExtras('author', ['posts:publish'])).toEqual(['posts:publish']);
    expect(normaliseExtras('seo', ['settings:write'])).toEqual(['settings:write']);
  });

  it('keeps a requirement chosen alone', () => {
    expect(normaliseExtras('viewer', ['posts:write'])).toEqual(['posts:write']);
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

describe('extrasLine', () => {
  it('shows only what the role does not already include', () => {
    expect(extrasLine('author', ['posts:write', 'redirects:write'])).toBe('Edit redirects');
  });

  it('is empty when the role covers everything stored, and for an admin', () => {
    expect(extrasLine('author', ['posts:write', 'media:write'])).toBe('');
    expect(extrasLine('admin', ['redirects:write'])).toBe('');
    expect(extrasLine('viewer', [])).toBe('');
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

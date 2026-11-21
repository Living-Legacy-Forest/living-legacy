import { describe, expect, it } from 'vitest';
import {
  canReceiveMagicLink,
  can,
  guardExtraPermissionsChange,
  guardRemoval,
  guardRoleChange,
  guardSuperAdminChange,
  isSuperAdmin,
  parseBootstrapEmails,
  resolveSignupRole,
  extraPermissionsSchema,
  grantablePermissions,
  parseExtraPermissions,
  permissionLabels,
  permissionRequires,
  permissions,
  permissionsFor,
  rolesGranting,
  toAccess,
  withRequiredPermissions,
} from './roles';

describe('can', () => {
  it('lets admins and editors manage events and their guests', () => {
    expect(can({ role: 'admin' }, 'events:manage')).toBe(true);
    expect(can({ role: 'editor' }, 'events:manage')).toBe(true);
    expect(can({ role: 'author' }, 'events:manage')).toBe(false);
    expect(can({ role: 'seo' }, 'events:manage')).toBe(false);
    expect(can({ role: 'viewer' }, 'events:manage')).toBe(false);
  });

  it('lets only admins publish legal pages', () => {
    expect(can({ role: 'admin' }, 'legal:publish')).toBe(true);
    for (const role of ['editor', 'author', 'seo', 'viewer'] as const) {
      expect(can({ role }, 'legal:publish')).toBe(false);
    }
    expect(can({ role: 'editor' }, 'content:write')).toBe(true);
  });

  it('lets admins do everything', () => {
    expect(can({ role: 'admin' }, 'users:manage')).toBe(true);
    expect(can({ role: 'admin' }, 'content:purge')).toBe(true);
  });

  it('limits editors to content and media', () => {
    expect(can({ role: 'editor' }, 'content:write')).toBe(true);
    expect(can({ role: 'editor' }, 'posts:publish')).toBe(true);
    expect(can({ role: 'editor' }, 'media:write')).toBe(true);
    expect(can({ role: 'editor' }, 'content:purge')).toBe(false);
    expect(can({ role: 'editor' }, 'settings:write')).toBe(false);
    expect(can({ role: 'editor' }, 'redirects:write')).toBe(false);
    expect(can({ role: 'editor' }, 'users:manage')).toBe(false);
  });

  it('lets authors write posts but not publish them', () => {
    expect(can({ role: 'author' }, 'posts:write')).toBe(true);
    expect(can({ role: 'author' }, 'media:write')).toBe(true);
    expect(can({ role: 'author' }, 'posts:publish')).toBe(false);
    expect(can({ role: 'author' }, 'content:write')).toBe(false);
  });

  it('limits SEO to search fields and redirects', () => {
    expect(can({ role: 'seo' }, 'seo:write')).toBe(true);
    expect(can({ role: 'seo' }, 'redirects:write')).toBe(true);
    expect(can({ role: 'seo' }, 'posts:write')).toBe(false);
    expect(can({ role: 'seo' }, 'settings:write')).toBe(false);
  });

  it('gives viewers no write access at all', () => {
    for (const permission of [
      'posts:write',
      'seo:write',
      'content:write',
      'media:write',
    ] as const) {
      expect(can({ role: 'viewer' }, permission)).toBe(false);
    }
  });
});

describe('resolveSignupRole', () => {
  it('refuses emails that are neither invited nor bootstrap admins', () => {
    expect(resolveSignupRole('stranger@example.com', {})).toBeNull();
    expect(resolveSignupRole('stranger@example.com', { invitedRole: null })).toBeNull();
  });

  it('uses the invited role', () => {
    expect(resolveSignupRole('writer@example.com', { invitedRole: 'editor' })).toBe('editor');
  });

  it('makes bootstrap emails admins, ignoring case, spaces and invitations', () => {
    const bootstrapAdminEmails = ' Owner@Example.com , other@example.com,';
    expect(resolveSignupRole('owner@example.com', { bootstrapAdminEmails })).toBe('admin');
    expect(
      resolveSignupRole('OTHER@example.com', { bootstrapAdminEmails, invitedRole: 'editor' })
    ).toBe('admin');
  });
});

describe('canReceiveMagicLink', () => {
  it('sends to existing accounts', () => {
    expect(canReceiveMagicLink({ hasAccount: true, signupRole: null })).toBe(true);
  });

  it('sends to invited or bootstrap emails with no account yet', () => {
    expect(canReceiveMagicLink({ hasAccount: false, signupRole: 'editor' })).toBe(true);
    expect(canReceiveMagicLink({ hasAccount: false, signupRole: 'admin' })).toBe(true);
  });

  it('refuses strangers so a link never reveals who has access', () => {
    expect(canReceiveMagicLink({ hasAccount: false, signupRole: null })).toBe(false);
  });
});

describe('guardRoleChange', () => {
  it('stops you changing your own role', () => {
    expect(guardRoleChange({ isSelf: true, targetIsLastAdmin: false, newRole: 'editor' })).toMatch(
      /your own/i
    );
  });

  it('stops demoting the last admin', () => {
    expect(guardRoleChange({ isSelf: false, targetIsLastAdmin: true, newRole: 'editor' })).toMatch(
      /at least one admin/i
    );
  });

  it('allows other changes', () => {
    expect(
      guardRoleChange({ isSelf: false, targetIsLastAdmin: false, newRole: 'admin' })
    ).toBeNull();
    // Re-affirming the last admin as admin is fine.
    expect(
      guardRoleChange({ isSelf: false, targetIsLastAdmin: true, newRole: 'admin' })
    ).toBeNull();
  });
});

describe('guardExtraPermissionsChange', () => {
  it('stops you changing your own access', () => {
    expect(guardExtraPermissionsChange({ isSelf: true })).toBe(
      'You cannot change your own access.'
    );
  });

  it('allows changing someone else’s', () => {
    expect(guardExtraPermissionsChange({ isSelf: false })).toBeNull();
  });
});

describe('guardRemoval', () => {
  it('stops you removing yourself', () => {
    expect(guardRemoval({ isSelf: true, targetIsLastAdmin: false })).toMatch(/yourself/i);
  });

  it('stops removing the last admin', () => {
    expect(guardRemoval({ isSelf: false, targetIsLastAdmin: true })).toMatch(/at least one admin/i);
  });

  it('allows removing others', () => {
    expect(guardRemoval({ isSelf: false, targetIsLastAdmin: false })).toBeNull();
  });
});

describe('extra permissions', () => {
  it('adds extras on top of the role without widening anything else', () => {
    const access = { role: 'author', extraPermissions: ['redirects:write'] } as const;
    expect(can(access, 'redirects:write')).toBe(true);
    expect(can(access, 'posts:write')).toBe(true);
    expect(can(access, 'settings:write')).toBe(false);
    expect(can({ role: 'viewer', extraPermissions: ['posts:write'] }, 'posts:write')).toBe(true);
  });

  it('gives a role with no extras only its own permissions', () => {
    expect(can({ role: 'author' }, 'redirects:write')).toBe(false);
  });

  it('never lets a hand-built access grant user management', () => {
    const access = { role: 'viewer', extraPermissions: ['users:manage'] } as const;
    expect(can(access, 'users:manage')).toBe(false);
  });

  it('keeps users:manage out of the grantable list and everything else in', () => {
    expect(grantablePermissions).not.toContain('users:manage');
    for (const permission of permissions.filter((p) => p !== 'users:manage')) {
      expect(grantablePermissions).toContain(permission);
    }
  });
});

describe('parseExtraPermissions', () => {
  it('returns an empty list for anything unusable', () => {
    for (const stored of ['not json', '{"a":1}', null, undefined, 42]) {
      expect(parseExtraPermissions(stored)).toEqual([]);
    }
  });

  it('de-duplicates', () => {
    expect(parseExtraPermissions('["redirects:write","redirects:write"]')).toEqual([
      'redirects:write',
    ]);
  });

  it('drops unknown and non-grantable names', () => {
    expect(parseExtraPermissions('["users:manage","bogus:thing","seo:write"]')).toEqual([
      'seo:write',
    ]);
  });

  it('accepts an array as well as a JSON string', () => {
    expect(parseExtraPermissions(['seo:write', 7])).toEqual(['seo:write']);
  });
});

describe('extraPermissionsSchema', () => {
  it('rejects user management and unknown names', () => {
    expect(extraPermissionsSchema.safeParse(['users:manage']).success).toBe(false);
    expect(extraPermissionsSchema.safeParse(['bogus:thing']).success).toBe(false);
  });

  it('de-duplicates valid input', () => {
    const parsed = extraPermissionsSchema.parse(['seo:write', 'seo:write']);
    expect(parsed).toEqual(['seo:write']);
  });

  it('adds what a permission needs on parse, so a publisher can always write', () => {
    expect(extraPermissionsSchema.parse(['posts:publish'])).toEqual([
      'posts:write',
      'posts:publish',
    ]);
    expect(extraPermissionsSchema.parse(['legal:publish'])).toEqual([
      'content:write',
      'legal:publish',
    ]);
    expect(extraPermissionsSchema.parse(['settings:write'])).toEqual([
      'seo:write',
      'settings:write',
    ]);
  });

  it('still rejects user management alongside a dependent permission', () => {
    expect(extraPermissionsSchema.safeParse(['posts:publish', 'users:manage']).success).toBe(false);
  });
});

describe('permissionLabels', () => {
  it('has a plain label for every permission', () => {
    for (const permission of permissions) {
      expect(permissionLabels[permission]).toMatch(/^[A-Z][a-z]/);
      expect(permissionLabels[permission]).not.toContain(':');
    }
  });

  it('says redirects and settings in plain words', () => {
    expect(permissionLabels['redirects:write']).toBe('Edit redirects');
    expect(permissionLabels['settings:write']).toBe('Change settings');
  });
});

describe('permissionRequires', () => {
  it('names what each dependent permission needs', () => {
    expect(permissionRequires).toEqual({
      'posts:publish': 'posts:write',
      'legal:publish': 'content:write',
      'settings:write': 'seo:write',
    });
  });
});

describe('withRequiredPermissions', () => {
  it('adds the permission each entry needs', () => {
    expect(withRequiredPermissions(['posts:publish'])).toEqual(['posts:write', 'posts:publish']);
    expect(withRequiredPermissions(['legal:publish'])).toEqual(['content:write', 'legal:publish']);
    expect(withRequiredPermissions(['settings:write'])).toEqual(['seo:write', 'settings:write']);
  });

  it('does not repeat a requirement that is already listed', () => {
    expect(withRequiredPermissions(['posts:publish', 'posts:write', 'posts:publish'])).toEqual([
      'posts:write',
      'posts:publish',
    ]);
  });

  it('leaves unrelated permissions alone, in a steady order', () => {
    expect(withRequiredPermissions(['settings:write', 'redirects:write'])).toEqual([
      'seo:write',
      'redirects:write',
      'settings:write',
    ]);
    expect(withRequiredPermissions(['redirects:write'])).toEqual(['redirects:write']);
    expect(withRequiredPermissions([])).toEqual([]);
  });

  it('does not add a dependent for a requirement chosen alone', () => {
    expect(withRequiredPermissions(['posts:write'])).toEqual(['posts:write']);
  });
});

describe('toAccess', () => {
  it('falls back to viewer for an unknown role', () => {
    const access = toAccess({ role: 'wizard', extraPermissions: '["seo:write"]' });
    expect(access.role).toBe('viewer');
    expect(access.extraPermissions).toEqual(['seo:write']);
  });

  it('treats missing extras as none', () => {
    expect(toAccess({ role: 'editor' })).toEqual({ role: 'editor', extraPermissions: [] });
  });

  it('falls back to viewer when the role is missing or null', () => {
    expect(toAccess({ role: null }).role).toBe('viewer');
    expect(toAccess({ role: undefined, extraPermissions: '["seo:write"]' })).toEqual({
      role: 'viewer',
      extraPermissions: ['seo:write'],
    });
    expect(toAccess({}).role).toBe('viewer');
  });
});

describe('rolesGranting', () => {
  it('lists the roles that carry a permission', () => {
    expect(rolesGranting('posts:publish')).toEqual(['admin', 'editor']);
  });
});

describe('permissionsFor', () => {
  it('merges role and extras without repeats', () => {
    const list = permissionsFor({
      role: 'author',
      extraPermissions: ['redirects:write', 'posts:write'],
    });
    expect(list).toEqual(expect.arrayContaining(['posts:write', 'media:write', 'redirects:write']));
    for (const permission of ['posts:write', 'media:write', 'redirects:write']) {
      expect(list.filter((p) => p === permission)).toHaveLength(1);
    }
    expect(list).toHaveLength(3);
  });
});

describe('parseBootstrapEmails', () => {
  it('splits, trims and lower-cases the list, skipping blanks', () => {
    expect(parseBootstrapEmails(' Boss@Example.com, ,second@example.com ,')).toEqual([
      'boss@example.com',
      'second@example.com',
    ]);
  });

  it('is empty when nothing is set', () => {
    expect(parseBootstrapEmails(undefined)).toEqual([]);
    expect(parseBootstrapEmails(null)).toEqual([]);
    expect(parseBootstrapEmails('')).toEqual([]);
  });
});

describe('isSuperAdmin', () => {
  const env = 'boss@example.com, second@example.com';

  it('is an admin whose email is in the bootstrap list, whatever its case', () => {
    expect(isSuperAdmin({ email: 'Boss@Example.com', role: 'admin' }, env)).toBe(true);
    expect(isSuperAdmin({ email: 'second@example.com', role: 'admin' }, env)).toBe(true);
  });

  it('is not an ordinary admin', () => {
    expect(isSuperAdmin({ email: 'other@example.com', role: 'admin' }, env)).toBe(false);
  });

  it('needs the admin role as well as the email', () => {
    expect(isSuperAdmin({ email: 'boss@example.com', role: 'editor' }, env)).toBe(false);
    expect(isSuperAdmin({ email: 'boss@example.com', role: 'wizard' }, env)).toBe(false);
  });

  it('is nobody when the list is empty or unset', () => {
    expect(isSuperAdmin({ email: 'boss@example.com', role: 'admin' }, '')).toBe(false);
    expect(isSuperAdmin({ email: 'boss@example.com', role: 'admin' }, undefined)).toBe(false);
  });
});

describe('guardSuperAdminChange', () => {
  it('stops an ordinary admin changing a super admin', () => {
    expect(guardSuperAdminChange({ targetIsSuperAdmin: true, actorIsSuperAdmin: false })).toBe(
      'Only a super admin can change a super admin.'
    );
  });

  it('lets a super admin change another, and anyone change an ordinary person', () => {
    expect(guardSuperAdminChange({ targetIsSuperAdmin: true, actorIsSuperAdmin: true })).toBeNull();
    expect(
      guardSuperAdminChange({ targetIsSuperAdmin: false, actorIsSuperAdmin: false })
    ).toBeNull();
  });
});

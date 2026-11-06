import { describe, expect, it } from 'vitest';
import {
  canReceiveMagicLink,
  can,
  guardRemoval,
  guardRoleChange,
  resolveSignupRole,
} from './roles';

describe('can', () => {
  it('lets admins and editors manage events and their guests', () => {
    expect(can('admin', 'events:manage')).toBe(true);
    expect(can('editor', 'events:manage')).toBe(true);
    expect(can('author', 'events:manage')).toBe(false);
    expect(can('seo', 'events:manage')).toBe(false);
    expect(can('viewer', 'events:manage')).toBe(false);
  });

  it('lets admins do everything', () => {
    expect(can('admin', 'users:manage')).toBe(true);
    expect(can('admin', 'content:purge')).toBe(true);
  });

  it('limits editors to content and media', () => {
    expect(can('editor', 'content:write')).toBe(true);
    expect(can('editor', 'posts:publish')).toBe(true);
    expect(can('editor', 'media:write')).toBe(true);
    expect(can('editor', 'content:purge')).toBe(false);
    expect(can('editor', 'settings:write')).toBe(false);
    expect(can('editor', 'redirects:write')).toBe(false);
    expect(can('editor', 'users:manage')).toBe(false);
  });

  it('lets authors write posts but not publish them', () => {
    expect(can('author', 'posts:write')).toBe(true);
    expect(can('author', 'media:write')).toBe(true);
    expect(can('author', 'posts:publish')).toBe(false);
    expect(can('author', 'content:write')).toBe(false);
  });

  it('limits SEO to search fields and redirects', () => {
    expect(can('seo', 'seo:write')).toBe(true);
    expect(can('seo', 'redirects:write')).toBe(true);
    expect(can('seo', 'posts:write')).toBe(false);
    expect(can('seo', 'settings:write')).toBe(false);
  });

  it('gives viewers no write access at all', () => {
    for (const permission of [
      'posts:write',
      'seo:write',
      'content:write',
      'media:write',
    ] as const) {
      expect(can('viewer', permission)).toBe(false);
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

import { describe, expect, it } from 'vitest';
import { can, resolveSignupRole } from './roles';

describe('can', () => {
  it('lets admins do everything', () => {
    expect(can('admin', 'users:manage')).toBe(true);
    expect(can('admin', 'content:purge')).toBe(true);
  });

  it('limits editors to content and media', () => {
    expect(can('editor', 'content:write')).toBe(true);
    expect(can('editor', 'media:write')).toBe(true);
    expect(can('editor', 'content:purge')).toBe(false);
    expect(can('editor', 'settings:write')).toBe(false);
    expect(can('editor', 'redirects:write')).toBe(false);
    expect(can('editor', 'users:manage')).toBe(false);
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

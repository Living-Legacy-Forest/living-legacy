import { user } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { hasPermissionSql } from './access-sql';

async function idsWith(permission: Parameters<typeof hasPermissionSql>[0]) {
  const rows = await testDb()
    .select({ id: user.id })
    .from(user)
    .where(hasPermissionSql(permission));
  return rows.map((r) => r.id).sort();
}

beforeEach(async () => {
  await testDb().delete(user);
});

describe('hasPermissionSql', () => {
  it('matches roles that grant it and people who were given it on top of a role', async () => {
    const admin = await addUser('admin');
    const editor = await addUser('editor');
    const withExtra = await addUser('author', 'Extra', ['posts:publish']);
    await addUser('author', 'Plain');
    await addUser('viewer');
    const malformed = await addUser('author', 'Broken');
    await testDb().update(user).set({ extraPermissions: 'not json' }).where(eq(user.id, malformed));
    // Valid JSON that is not an array must not match either, as `can` denies it.
    for (const stored of ['"posts:publish"', '{"a":"posts:publish"}']) {
      const odd = await addUser('author', 'Odd');
      await testDb().update(user).set({ extraPermissions: stored }).where(eq(user.id, odd));
    }

    expect(await idsWith('posts:publish')).toEqual([admin, editor, withExtra].sort());
  });

  it('never lets an extra grant a permission that is not grantable', async () => {
    const admin = await addUser('admin');
    const sneaky = await addUser('author', 'Sneaky');
    await testDb()
      .update(user)
      .set({ extraPermissions: JSON.stringify(['users:manage']) })
      .where(eq(user.id, sneaky));

    expect(await idsWith('users:manage')).toEqual([admin]);
  });
});

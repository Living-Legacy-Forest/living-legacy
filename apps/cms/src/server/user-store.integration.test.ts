import { extraPermissionsSchema } from '@ll/content';
import { activityLog, invitation, user } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { listTeamRows, saveInvitation, setUserExtraPermissions } from './user-store';

let actor = { id: '', name: 'Sam Tester' };
const stored = async (id: string) =>
  (await testDb().select().from(user).where(eq(user.id, id)))[0]!.extraPermissions;

describe('extra permissions', () => {
  beforeEach(async () => {
    await testDb().delete(activityLog);
    await testDb().delete(invitation);
    actor = { id: await addUser('admin'), name: 'Sam Tester' };
  });

  it('stores the extras and logs what changed', async () => {
    const id = await addUser('author', 'Alex Author');
    await setUserExtraPermissions(testDb(), id, ['redirects:write'], actor);

    expect(await stored(id)).toBe('["redirects:write"]');
    const rows = await testDb().select().from(activityLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: actor.id,
      action: 'user.permissions_changed',
      summary: "Changed Alex Author's extra access from none to Edit redirects",
    });
  });

  it('names a person with no name by their email address', async () => {
    // People who sign in by emailed link can have an empty name.
    const id = await addUser('author', '');
    const [row] = await testDb().select().from(user).where(eq(user.id, id));
    await setUserExtraPermissions(testDb(), id, ['redirects:write'], actor);

    const [log] = await testDb().select().from(activityLog);
    expect(log!.summary).toBe(`Changed ${row!.email}'s extra access from none to Edit redirects`);
  });

  it('clears the extras and names what was removed', async () => {
    const id = await addUser('author', 'Alex Author', ['redirects:write', 'content:write']);
    await setUserExtraPermissions(testDb(), id, [], actor);

    expect(await stored(id)).toBe('[]');
    const [row] = await testDb().select().from(activityLog);
    expect(row!.summary).toBe(
      "Changed Alex Author's extra access from Edit redirects, Edit FAQs, testimonials, team and announcements to none"
    );
  });

  it('says so when the person no longer exists, and logs nothing', async () => {
    await expect(
      setUserExtraPermissions(testDb(), 'missing-id', ['redirects:write'], actor)
    ).rejects.toThrow('That user no longer exists.');
    expect(await testDb().select().from(activityLog)).toHaveLength(0);
  });

  it('replaces the extras when the same email is invited again', async () => {
    const invite = (extraPermissions: Parameters<typeof saveInvitation>[1]['extraPermissions']) =>
      saveInvitation(testDb(), {
        email: 'new@example.test',
        role: 'author',
        extraPermissions,
        invitedBy: actor.id,
      });
    await invite(['redirects:write', 'content:write']);
    await invite(['redirects:write']);

    const rows = await testDb().select().from(invitation);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.extraPermissions).toBe('["redirects:write"]');

    await invite([]);
    expect((await testDb().select().from(invitation))[0]!.extraPermissions).toBe('[]');
  });

  it('stores what a publisher needs to save when the input goes through the schema', async () => {
    // The server functions validate with this schema, so this is what reaches the database.
    const id = await addUser('viewer', 'Vi Viewer');
    await setUserExtraPermissions(
      testDb(),
      id,
      extraPermissionsSchema.parse(['posts:publish']),
      actor
    );
    expect(await stored(id)).toBe('["posts:write","posts:publish"]');

    await saveInvitation(testDb(), {
      email: 'new@example.test',
      role: 'viewer',
      extraPermissions: extraPermissionsSchema.parse(['settings:write', 'legal:publish']),
      invitedBy: actor.id,
    });
    expect((await testDb().select().from(invitation))[0]!.extraPermissions).toBe(
      '["seo:write","content:write","settings:write","legal:publish"]'
    );
  });

  it('lists extras as arrays, with malformed stored values as empty', async () => {
    const good = await addUser('author', 'Good', ['redirects:write']);
    const bad = await addUser('author', 'Bad');
    await testDb().update(user).set({ extraPermissions: '{not json' }).where(eq(user.id, bad));
    await saveInvitation(testDb(), {
      email: 'pending@example.test',
      role: 'viewer',
      extraPermissions: ['content:write'],
      invitedBy: actor.id,
    });
    await testDb()
      .update(invitation)
      .set({ extraPermissions: '"oops"' })
      .where(eq(invitation.email, 'pending@example.test'));

    const { users, invitations } = await listTeamRows(testDb());
    expect(users.find((u) => u.id === good)!.extraPermissions).toEqual(['redirects:write']);
    expect(users.find((u) => u.id === bad)!.extraPermissions).toEqual([]);
    expect(invitations[0]!.extraPermissions).toEqual([]);
  });
});

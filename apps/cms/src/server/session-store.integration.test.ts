import { session } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, days, testDb } from '../../test/fixtures';
import { listUserSessions, signOutUserSessions } from './session-store';

let me = '';
let someoneElse = '';

async function addSession(userId: string, id: string, updatedAgo = 0, expiresIn = days(10)) {
  const now = Date.now();
  await testDb()
    .insert(session)
    .values({
      id,
      token: `token-${id}`,
      userId,
      userAgent: 'Mozilla/5.0 (Macintosh) Chrome/131.0 Safari/537.36',
      ipAddress: '203.0.113.1',
      createdAt: new Date(now - days(20)),
      updatedAt: new Date(now - updatedAgo),
      expiresAt: new Date(now + expiresIn),
    });
}

describe('session store', () => {
  beforeEach(async () => {
    await testDb().delete(session);
    me = await addUser('editor', 'Me');
    someoneElse = await addUser('editor', 'Someone else');
    await addSession(me, 'here');
    await addSession(me, 'phone', days(2));
    await addSession(me, 'old', days(1), -days(1)); // expired
    await addSession(someoneElse, 'theirs');
  });

  it('lists only my live sessions, this one first, without tokens', async () => {
    const list = await listUserSessions(testDb(), me, 'here');
    expect(list.map((s) => [s.id, s.current])).toEqual([
      ['here', true],
      ['phone', false],
    ]);
    expect(JSON.stringify(list)).not.toContain('token-');
  });

  it('signs out one of my other devices', async () => {
    await signOutUserSessions(testDb(), me, 'here', { only: 'phone' });
    expect((await listUserSessions(testDb(), me, 'here')).map((s) => s.id)).toEqual(['here']);
  });

  it('will not sign out this device from the list', async () => {
    await expect(signOutUserSessions(testDb(), me, 'here', { only: 'here' })).rejects.toThrow(
      'Use Sign out in the menu'
    );
  });

  it("cannot touch someone else's session", async () => {
    await signOutUserSessions(testDb(), me, 'here', { only: 'theirs' });
    expect(await listUserSessions(testDb(), someoneElse, 'theirs')).toHaveLength(1);
  });

  it('signs out everywhere else and keeps this device', async () => {
    await signOutUserSessions(testDb(), me, 'here', { allOthers: true });
    expect((await listUserSessions(testDb(), me, 'here')).map((s) => s.id)).toEqual(['here']);
    expect(await listUserSessions(testDb(), someoneElse, 'theirs')).toHaveLength(1);
  });
});

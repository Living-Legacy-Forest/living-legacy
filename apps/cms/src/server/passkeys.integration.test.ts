import { activityLog } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { logPasskeyChange } from './passkeys';

beforeEach(async () => {
  await testDb().delete(activityLog);
});

describe('logPasskeyChange', () => {
  it('logs an added passkey against its owner', async () => {
    const id = await addUser();
    await logPasskeyChange(testDb(), { id, name: 'Sam Tester' }, 'user.passkey_added');

    const rows = await testDb().select().from(activityLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'user.passkey_added',
      actorId: id,
      actorName: 'Sam Tester',
      summary: 'Added a passkey',
    });
  });

  it('logs a removed passkey', async () => {
    const id = await addUser();
    await logPasskeyChange(testDb(), { id, name: 'Sam Tester' }, 'user.passkey_removed');

    const [row] = await testDb().select().from(activityLog);
    expect(row).toMatchObject({ action: 'user.passkey_removed', summary: 'Removed a passkey' });
  });
});

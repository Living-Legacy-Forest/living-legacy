import { passkey, user } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';

beforeEach(async () => {
  await testDb().delete(passkey);
});

describe('passkey table', () => {
  it("removes a user's passkeys with the user", async () => {
    const id = await addUser();
    await testDb().insert(passkey).values({
      id: crypto.randomUUID(),
      name: 'iPhone',
      publicKey: 'public-key',
      userId: id,
      credentialID: 'credential-1',
      counter: 0,
      deviceType: 'multiDevice',
      backedUp: true,
      transports: 'internal,hybrid',
      createdAt: new Date(),
    });

    await testDb().delete(user).where(eq(user.id, id));

    expect(await testDb().select().from(passkey)).toEqual([]);
  });
});

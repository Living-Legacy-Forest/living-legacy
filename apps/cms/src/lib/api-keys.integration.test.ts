import type { Permission, Role } from '@ll/content';
import { apiKeys, user } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { addUser, minutes, testDb } from '../../test/fixtures';
import { type ApiActor, authenticateApiRequest, generateApiKey, hashApiKey } from './api-keys';

async function addKey(
  role: Role,
  scope: 'read' | 'write',
  extra: Partial<typeof apiKeys.$inferInsert> = {},
  extraPermissions: Permission[] = []
) {
  const userId = await addUser(role, `Key owner (${role})`, extraPermissions);
  const { key, prefix } = generateApiKey();
  const [row] = await testDb()
    .insert(apiKeys)
    .values({
      name: 'Automation',
      prefix,
      keyHash: await hashApiKey(key),
      scope,
      createdBy: userId,
      ...extra,
    })
    .returning();
  return { key, id: row!.id, userId };
}

const request = (key?: string) =>
  new Request('https://cms.example.test/api/v1/posts', {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });

async function expectError(result: ApiActor | Response, status: number, message: string) {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: expect.stringContaining(message) });
}

describe('authenticateApiRequest', () => {
  it('asks for a key when none is sent', async () => {
    await expectError(await authenticateApiRequest(request(), 'read'), 401, 'Send an API key');
    await expectError(
      await authenticateApiRequest(request('not-a-key'), 'read'),
      401,
      'Send an API key'
    );
  });

  it('refuses a key it does not know', async () => {
    const { key } = generateApiKey();
    await expectError(await authenticateApiRequest(request(key), 'read'), 401, 'not valid');
  });

  it('refuses a revoked key', async () => {
    const { key } = await addKey('admin', 'write', { revokedAt: new Date() });
    await expectError(await authenticateApiRequest(request(key), 'read'), 401, 'not valid');
  });

  it('acts as the person who made the key, and notes when it was used', async () => {
    const { key, id, userId } = await addKey('editor', 'read');
    const actor = await authenticateApiRequest(request(key), 'read');
    expect(actor).toMatchObject({ keyId: id, userId, role: 'editor', scope: 'read' });

    const row = await testDb().query.apiKeys.findFirst({ where: eq(apiKeys.id, id) });
    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });

  it('records use at most once a minute', async () => {
    const recently = new Date(Date.now() - minutes(0.5));
    const { key, id } = await addKey('editor', 'read', { lastUsedAt: recently });
    await authenticateApiRequest(request(key), 'read');
    const row = await testDb().query.apiKeys.findFirst({ where: eq(apiKeys.id, id) });
    expect(row?.lastUsedAt?.getTime()).toBe(recently.getTime());
  });

  it('only lets write keys write', async () => {
    const { key } = await addKey('admin', 'read');
    await expectError(await authenticateApiRequest(request(key), 'write'), 403, 'can only read');
  });

  it('stops a write key working once its owner can no longer change posts', async () => {
    const { key, userId } = await addKey('editor', 'write');
    expect(await authenticateApiRequest(request(key), 'write')).not.toBeInstanceOf(Response);

    await testDb().update(user).set({ role: 'viewer' }).where(eq(user.id, userId));
    await expectError(await authenticateApiRequest(request(key), 'write'), 403, 'can only read');
  });

  it('lets a write key work for an owner who was given posts:write on top of a viewer role', async () => {
    const { key, userId } = await addKey('viewer', 'write', {}, ['posts:write']);
    const actor = await authenticateApiRequest(request(key), 'write');
    expect(actor).not.toBeInstanceOf(Response);
    expect(actor).toMatchObject({ userId, role: 'viewer', extraPermissions: ['posts:write'] });
  });

  it('refuses a write key whose viewer owner has no extra permissions', async () => {
    const { key } = await addKey('viewer', 'write');
    await expectError(await authenticateApiRequest(request(key), 'write'), 403, 'can only read');
  });

  it('stops working when its owner is removed', async () => {
    const { key, userId } = await addKey('admin', 'write');
    await testDb().delete(user).where(eq(user.id, userId));
    await expectError(await authenticateApiRequest(request(key), 'read'), 401, 'not valid');
  });
});

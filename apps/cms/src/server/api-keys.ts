import { apiKeyScopes } from '@llf/db/enums';
import { apiKeys, user } from '@llf/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { generateApiKey, hashApiKey } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';

/** Every key, newest first, including revoked ones (shown as such). */
export const listApiKeys = createServerFn({ method: 'GET' })
  .middleware([requirePermission('settings:write')])
  .handler(async () => {
    const rows = await getDb()
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scope: apiKeys.scope,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdByName: user.name,
      })
      .from(apiKeys)
      .leftJoin(user, eq(user.id, apiKeys.createdBy))
      .orderBy(desc(apiKeys.createdAt));
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.getTime(),
      lastUsedAt: r.lastUsedAt?.getTime() ?? null,
      revokedAt: r.revokedAt?.getTime() ?? null,
    }));
  });

export type ApiKeyRow = Awaited<ReturnType<typeof listApiKeys>>[number];

/** Creates a key and returns it in full. This is the only time it is shown. */
export const createApiKey = createServerFn({ method: 'POST' })
  .middleware([requirePermission('settings:write')])
  .validator(
    z.object({
      name: z.string().trim().min(1, 'Give the key a name.').max(80),
      scope: z.enum(apiKeyScopes),
    })
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    const { key, prefix } = generateApiKey();
    await db.batch([
      db.insert(apiKeys).values({
        name: data.name,
        prefix,
        keyHash: await hashApiKey(key),
        scope: data.scope,
        createdBy: context.user.id,
      }),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'api_key.created',
        summary: `Created ${data.scope === 'write' ? 'a read and write' : 'a read-only'} API key, "${data.name}"`,
      }),
    ]);
    return { key };
  });

export const revokeApiKey = createServerFn({ method: 'POST' })
  .middleware([requirePermission('settings:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [row] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, data.id), isNull(apiKeys.revokedAt)))
      .returning({ name: apiKeys.name });
    if (!row) throw new Error('That key was already revoked.');
    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'api_key.revoked',
      summary: `Revoked the API key "${row.name}"`,
    });
  });

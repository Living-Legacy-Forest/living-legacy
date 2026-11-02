/**
 * API keys for /api/v1. A key is "llk_" plus 32 random bytes (base64url), so
 * it cannot be guessed and a plain SHA-256 is enough to store it safely: only
 * the hash is kept, and a key is shown once, when it is created.
 *
 * A key acts as the admin who created it. It stops working when revoked, when
 * that person is removed, or when they can no longer do what the key's scope
 * allows (read needs any role; write needs posts:write).
 */
import { type Role, can } from '@llf/content';
import { schema } from '@llf/db';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from './db';

const { apiKeys, user } = schema;

export type ApiKeyScope = (typeof schema.apiKeyScopes)[number];

const KEY_PREFIX = 'llk_';
/** Characters shown in the CMS so people can tell their keys apart. */
const VISIBLE_LENGTH = 12;
/** Last-used is a rough guide, so it is written at most once a minute. */
const TOUCH_MS = 60_000;

export function generateApiKey(): { key: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const body = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const key = `${KEY_PREFIX}${body}`;
  return { key, prefix: key.slice(0, VISIBLE_LENGTH) };
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type ApiActor = {
  keyId: string;
  keyName: string;
  scope: ApiKeyScope;
  userId: string;
  userName: string;
  role: Role;
};

/** A JSON error in the API's one shape: `{ "error": "…" }`. */
export function apiError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * The key behind a request's `Authorization: Bearer …` header, or an error
 * response to send back. Write requests also need a write-scoped key.
 */
export async function authenticateApiRequest(
  request: Request,
  needs: ApiKeyScope
): Promise<ApiActor | Response> {
  const header = request.headers.get('authorization') ?? '';
  const key = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
  if (!key?.startsWith(KEY_PREFIX)) {
    return apiError(401, 'Send an API key as "Authorization: Bearer llk_…".');
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      scope: apiKeys.scope,
      lastUsedAt: apiKeys.lastUsedAt,
      userId: user.id,
      userName: user.name,
      role: user.role,
    })
    .from(apiKeys)
    .innerJoin(user, eq(user.id, apiKeys.createdBy))
    .where(and(eq(apiKeys.keyHash, await hashApiKey(key)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return apiError(401, 'That API key is not valid, or has been revoked.');

  const role = row.role as Role;
  if (needs === 'write' && (row.scope !== 'write' || !can(role, 'posts:write'))) {
    return apiError(403, 'This API key can only read. Create a key with write access.');
  }

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_MS) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  }

  return {
    keyId: row.id,
    keyName: row.name,
    scope: row.scope,
    userId: row.userId,
    userName: row.userName,
    role,
  };
}

/** Parses a JSON request body, or returns a 400 to send back. */
export async function readJson(request: Request): Promise<unknown | Response> {
  try {
    return await request.json();
  } catch {
    return apiError(400, 'The request body must be JSON.');
  }
}

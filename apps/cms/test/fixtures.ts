import type { Permission, Role } from '@ll/content';
import { createDb } from '@ll/db';
import { user } from '@ll/db/schema';
import { env } from 'cloudflare:workers';

/** Drizzle over the test file's local D1 (integration tests only). */
export const testDb = () => createDb(env.DB);

/** A CMS user; returns their id. */
export async function addUser(
  role: Role = 'admin',
  name = 'Sam Tester',
  extraPermissions: Permission[] = []
) {
  const id = crypto.randomUUID();
  const now = new Date();
  await testDb()
    .insert(user)
    .values({
      id,
      name,
      email: `${id}@example.test`,
      role,
      extraPermissions: JSON.stringify(extraPermissions),
      createdAt: now,
      updatedAt: now,
    });
  return id;
}

export const minutes = (n: number) => n * 60_000;
export const days = (n: number) => n * 86_400_000;

// Where someone is signed in, for the Devices list on their profile. Our own
// queries rather than the sign-in library's, which only answer for a session
// signed in within the last day and hand the browser every session token.
// Signing out deletes the session; a device that cached it in its cookie
// stops working within the 5-minute cookie cache (lib/auth.ts).
import type { Db } from '@ll/db';
import { session } from '@ll/db/schema';
import { and, desc, eq, gt, ne } from 'drizzle-orm';

export type DeviceSession = {
  id: string;
  userAgent: string | null;
  updatedAt: number;
  current: boolean;
};

export async function listUserSessions(
  db: Db,
  userId: string,
  currentId: string
): Promise<DeviceSession[]> {
  const rows = await db
    .select({ id: session.id, userAgent: session.userAgent, updatedAt: session.updatedAt })
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt));
  return rows
    .map((r) => ({
      id: r.id,
      userAgent: r.userAgent ?? null,
      updatedAt: r.updatedAt.getTime(),
      current: r.id === currentId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function signOutUserSessions(
  db: Db,
  userId: string,
  currentId: string,
  which: { only: string } | { allOthers: true }
) {
  if ('only' in which) {
    if (which.only === currentId) {
      throw new Error('Use Sign out in the menu to sign out of this device.');
    }
    await db.delete(session).where(and(eq(session.userId, userId), eq(session.id, which.only)));
    return;
  }
  await db.delete(session).where(and(eq(session.userId, userId), ne(session.id, currentId)));
}

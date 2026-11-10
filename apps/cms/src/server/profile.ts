import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { listUserSessions, signOutUserSessions } from './session-store';

/** The session making this request, which the Devices list marks as this device. */
async function currentSessionId() {
  const current = await getAuth().api.getSession({ headers: getRequest().headers });
  if (!current) throw new Error('You need to sign in.');
  return current.session.id;
}

export const listMyDevices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    listUserSessions(getDb(), context.user.id, await currentSessionId())
  );

export const signOutDevice = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) =>
    signOutUserSessions(getDb(), context.user.id, await currentSessionId(), { only: data.id })
  );

export const signOutOtherDevices = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    signOutUserSessions(getDb(), context.user.id, await currentSessionId(), { allOthers: true })
  );

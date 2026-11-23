import { appearanceSchema } from '@ll/content';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { user } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { deleteOwnAvatar } from '@/lib/avatars';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { adoptBanner, removeBanner } from './banner-store';
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

const seedSchema = z.string().regex(/^[\w-]{1,64}$/, 'That avatar could not be used.');

/** Shows a drawn avatar instead of a photo: the photo, if any, is removed. */
export const setMyAvatar = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ seed: seedSchema }))
  .handler(async ({ data, context }) => {
    await deleteOwnAvatar(context.user.image, context.user.id);
    await getDb()
      .update(user)
      .set({ image: null, imageAlt: null, avatarSeed: data.seed, updatedAt: new Date() })
      .where(eq(user.id, context.user.id));
  });

/** Back to initials: no photo and no chosen avatar. */
export const clearMyPicture = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await deleteOwnAvatar(context.user.image, context.user.id);
    await getDb()
      .update(user)
      .set({ image: null, imageAlt: null, avatarSeed: null, updatedAt: new Date() })
      .where(eq(user.id, context.user.id));
  });

/** Makes an uploaded file this person's banner; it must be one they just uploaded. */
export const setMyBanner = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ url: z.string().max(200) }))
  .handler(({ data, context }) =>
    adoptBanner(getDb(), context.user.id, context.user.banner, data.url)
  );

/** This person's own colour and sidebar grain; both null goes back to following the site. */
export const setMyAppearance = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(appearanceSchema)
  .handler(async ({ data, context }) => {
    const stored = data.colour || data.grain !== null ? JSON.stringify(data) : null;
    await getDb()
      .update(user)
      .set({ appearance: stored, updatedAt: new Date() })
      .where(eq(user.id, context.user.id));
  });

/** Back to the default gradient. */
export const clearMyBanner = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(({ context }) => removeBanner(getDb(), context.user.id, context.user.banner));

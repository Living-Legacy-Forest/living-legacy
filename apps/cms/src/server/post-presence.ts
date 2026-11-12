import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware } from '@/lib/session';
import { checkIn, checkOut } from './post-presence-store';

export type { Editor, Presence } from './post-presence-store';

/** This editor is still open; who else is, and has someone else saved since `since`? */
export const checkInToPost = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ postId: z.string(), since: z.number().nullable() }))
  .handler(({ data, context }) => checkIn(getDb(), data.postId, context.user.id, data.since));

export const checkOutOfPost = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ postId: z.string() }))
  .handler(({ data, context }) => checkOut(getDb(), data.postId, context.user.id));

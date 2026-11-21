/**
 * Avatar upload. Separate from /api/media: any signed-in person can set
 * their own avatar, not just those with media:write, and it never appears in
 * the shared Media library. An admin may send a `userId` to set someone
 * else's. A raw handler, since multipart can't go through createServerFn.
 */
import { can, imageExtension, imageSize, toAccess } from '@ll/content';
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { deleteOwnAvatar } from '@/lib/avatars';
import { getDb } from '@/lib/db';
import { logActivity } from '@/server/activity-log';

const { user } = schema;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

export const Route = createFileRoute('/api/avatar/')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });

        const form = await request.formData();
        const forUserId = form.get('userId');
        const isSelf = typeof forUserId !== 'string' || forUserId === session.user.id;
        if (!isSelf && !can(toAccess(session.user), 'users:manage')) {
          return new Response('Forbidden', { status: 403 });
        }
        const db = getDb();
        const target = isSelf
          ? session.user
          : await db.query.user.findFirst({ where: eq(user.id, forUserId as string) });
        if (!target)
          return Response.json({ error: 'That user no longer exists.' }, { status: 404 });
        const file = form.get('file');
        if (!(file instanceof File)) {
          return Response.json({ error: 'No file was uploaded.' }, { status: 400 });
        }
        if (!ALLOWED_MIME.has(file.type)) {
          return Response.json(
            { error: 'Only JPEG, PNG, WebP, AVIF and GIF images are supported.' },
            { status: 400 }
          );
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: 'That file is larger than 5 MB.' }, { status: 400 });
        }

        // Checked like /api/media: the file must really be an image, whatever
        // type the browser declared.
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!imageSize(bytes)) {
          return Response.json({ error: 'That image could not be read.' }, { status: 400 });
        }

        // The extension comes from the checked type, never the file's own name.
        const key = `avatar-${crypto.randomUUID()}.${imageExtension(file.type)}`;
        await env.MEDIA.put(key, bytes, {
          httpMetadata: { contentType: file.type },
          customMetadata: { userId: target.id },
        });

        await deleteOwnAvatar(target.image, target.id);

        const url = `/api/avatar/${key}`;
        // Your own photo is saved by the browser through Better Auth, which
        // also refreshes your session; someone else's is saved here.
        if (!isSelf) {
          await db
            .update(user)
            .set({ image: url, updatedAt: new Date() })
            .where(eq(user.id, target.id));
          await logActivity(db, {
            actorId: session.user.id,
            actorName: session.user.name,
            action: 'user.photo_changed',
            summary: `Changed ${target.name}'s photo`,
          });
        }

        return Response.json({ url });
      },
    },
  },
});

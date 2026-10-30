/**
 * Avatar upload. Separate from /api/media: any signed-in person can set
 * their own avatar, not just those with media:write, and it never appears in
 * the shared Media library. A raw handler, since multipart can't go through
 * createServerFn.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getAuth } from '@/lib/auth';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const Route = createFileRoute('/api/avatar/')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });

        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
          return Response.json({ error: 'No file was uploaded.' }, { status: 400 });
        }
        if (!ALLOWED_MIME.has(file.type)) {
          return Response.json(
            { error: 'Only JPEG, PNG, WebP and GIF images are supported.' },
            { status: 400 }
          );
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ error: 'That file is larger than 5 MB.' }, { status: 400 });
        }

        const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
        const key = `avatar-${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
        await env.MEDIA.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type },
        });

        // The old object is otherwise orphaned: nothing else references it by key.
        const previousKey = avatarKey(session.user.image);
        if (previousKey) await env.MEDIA.delete(previousKey);

        return Response.json({ url: `/api/avatar/${key}` });
      },
    },
  },
});

function avatarKey(image: string | null | undefined): string | null {
  const match = image?.match(/^\/api\/avatar\/(avatar-[^/]+)$/);
  return match?.[1] ?? null;
}

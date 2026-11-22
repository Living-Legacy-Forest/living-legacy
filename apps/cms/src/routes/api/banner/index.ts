/**
 * Banner upload. Like /api/avatar, any signed-in person can set their own, and it never appears
 * in the shared Media library. The file is only stored and tagged with its owner here; the profile
 * saves it with `setMyBanner`, which checks the tag. A raw handler, since multipart can't go
 * through createServerFn.
 */
import { imageExtension, imageSize } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getAuth } from '@/lib/auth';
import { bannerUrl } from '@/lib/banner';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

export const Route = createFileRoute('/api/banner/')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });

        const file = (await request.formData()).get('file');
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

        // The file must really be an image, whatever type the browser declared.
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!imageSize(bytes)) {
          return Response.json({ error: 'That image could not be read.' }, { status: 400 });
        }

        // The extension comes from the checked type, never the file's own name.
        const key = `banner-${crypto.randomUUID()}.${imageExtension(file.type)}`;
        await env.MEDIA.put(key, bytes, {
          httpMetadata: { contentType: file.type },
          customMetadata: { userId: session.user.id },
        });
        return Response.json({ url: bannerUrl(key) });
      },
    },
  },
});

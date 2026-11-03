/**
 * Upload. A raw handler rather than a server function, since a server
 * function's validator expects JSON and this receives multipart form data.
 */
import { type Role, can } from '@ll/content';
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const { media } = schema;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const Route = createFileRoute('/api/media/')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });
        if (!can(session.user.role as Role, 'media:write')) {
          return new Response('Forbidden', { status: 403 });
        }

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
          return Response.json({ error: 'That file is larger than 10 MB.' }, { status: 400 });
        }

        // Measured in the browser before upload; the website uses them to
        // reserve space for the image. Optional, and ignored if implausible.
        const dimension = (key: string) => {
          const n = Number(form.get(key));
          return Number.isInteger(n) && n > 0 && n <= 20_000 ? n : null;
        };

        const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
        const r2Key = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
        await env.MEDIA.put(r2Key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type },
        });

        const db = getDb();
        const [row] = await db
          .insert(media)
          .values({
            r2Key,
            filename: file.name || r2Key,
            mime: file.type,
            size: file.size,
            width: dimension('width'),
            height: dimension('height'),
            uploadedBy: session.user.id,
          })
          .returning();
        if (!row) return Response.json({ error: 'Could not save the upload.' }, { status: 500 });

        return Response.json({
          id: row.id,
          filename: row.filename,
          mime: row.mime,
          size: row.size,
          width: row.width,
          height: row.height,
          alt: '',
          caption: '',
          createdAt: row.createdAt.getTime(),
          url: `/api/media/${row.id}`,
        });
      },
    },
  },
});

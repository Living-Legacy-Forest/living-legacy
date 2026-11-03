/**
 * Upload. A raw handler rather than a server function, since a server
 * function's validator expects JSON and this receives multipart form data.
 */
import { type Role, can } from '@ll/content';
import { schema } from '@ll/db';
import { type MediaVariant, mediaVariantWidths } from '@ll/db/enums';
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
        const base = crypto.randomUUID();
        const r2Key = `${base}${ext ? `.${ext}` : ''}`;
        const width = dimension('width');

        // Smaller copies made in the browser. One that is not actually smaller
        // than the original would only waste space, so it is dropped.
        const sizes: { variant: MediaVariant; file: File }[] = [];
        for (const w of mediaVariantWidths) {
          const copy = form.get(`size-${w}`);
          if (!(copy instanceof File) || !ALLOWED_MIME.has(copy.type)) continue;
          if (copy.type === 'image/gif' || copy.size >= file.size) continue;
          if (width !== null && w >= width) continue;
          const key = `${base}-w${w}.${copy.type.split('/')[1]!.replace('jpeg', 'jpg')}`;
          sizes.push({ variant: { width: w, key, mime: copy.type }, file: copy });
        }

        await Promise.all([
          env.MEDIA.put(r2Key, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
          }),
          ...sizes.map(async (s) =>
            env.MEDIA.put(s.variant.key, await s.file.arrayBuffer(), {
              httpMetadata: { contentType: s.variant.mime },
            })
          ),
        ]);

        const db = getDb();
        const [row] = await db
          .insert(media)
          .values({
            r2Key,
            filename: file.name || r2Key,
            mime: file.type,
            size: file.size,
            width,
            height: dimension('height'),
            variants: sizes.length ? sizes.map((s) => s.variant) : null,
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

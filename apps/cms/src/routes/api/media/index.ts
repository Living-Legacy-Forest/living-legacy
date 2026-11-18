/**
 * Upload, or replace the file behind an existing image (`replace=<id>`). A raw
 * handler rather than a server function, since a server function's validator
 * expects JSON and this receives multipart form data.
 */
import { type Role, can, isDocumentMime } from '@ll/content';
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { UploadError, replaceMediaFile, storeUpload } from '@/server/media-store';

const { media } = schema;

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
        const replace = form.get('replace');
        const db = getDb();

        let stored;
        try {
          stored = await storeUpload(form);
        } catch (error) {
          if (error instanceof UploadError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          throw error;
        }

        if (typeof replace === 'string' && replace) {
          try {
            const row = await replaceMediaFile(db, {
              id: replace,
              stored,
              actor: { id: session.user.id, name: session.user.name },
              origin: new URL(request.url).origin,
            });
            return Response.json(toResponse(row));
          } catch (error) {
            if (error instanceof UploadError) {
              return Response.json({ error: error.message }, { status: error.status });
            }
            console.error('[media] could not replace the file', error);
            return Response.json({ error: 'Could not replace the file.' }, { status: 500 });
          }
        }

        // Without a row nothing points at the files, so they go too. Anything
        // this misses is cleared by the daily sweep (server/media-sweep.ts).
        const row = await db
          .insert(media)
          .values({
            r2Key: stored.r2Key,
            filename: stored.filename,
            mime: stored.mime,
            size: stored.size,
            width: stored.width,
            height: stored.height,
            variants: stored.variants,
            uploadedBy: session.user.id,
          })
          .returning()
          .then((rows) => rows[0])
          .catch((error: unknown) => {
            console.error('[media] could not save the upload', error);
            return undefined;
          });
        if (!row) {
          await env.MEDIA.delete(stored.keys).catch(() => {});
          return Response.json({ error: 'Could not save the upload.' }, { status: 500 });
        }

        return Response.json(toResponse(row));
      },
    },
  },
});

function toResponse(row: typeof media.$inferSelect) {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt ?? '',
    caption: row.caption ?? '',
    createdAt: row.createdAt.getTime(),
    version: row.updatedAt.getTime(),
    url: `/api/media/${row.id}`,
    hasCover: isDocumentMime(row.mime) && !!row.variants?.length,
  };
}

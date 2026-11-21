/**
 * Gives a PDF in the library its first-page thumbnail (`cover`, a JPEG made in the browser). A raw
 * handler, like /api/media, since it receives multipart form data.
 */
import { can, toAccess } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { UploadError, attachPdfCover } from '@/server/media-store';

export const Route = createFileRoute('/api/media-cover/$id')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });
        if (!can(toAccess(session.user), 'media:write')) {
          return new Response('Forbidden', { status: 403 });
        }

        try {
          const form = await request.formData();
          await attachPdfCover(getDb(), {
            id: params.id,
            cover: form.get('cover'),
            origin: new URL(request.url).origin,
          });
          return Response.json({ ok: true });
        } catch (error) {
          if (error instanceof UploadError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error('[media] could not save the thumbnail', error);
          return Response.json({ error: 'Could not save the thumbnail.' }, { status: 500 });
        }
      },
    },
  },
});

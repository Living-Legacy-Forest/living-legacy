/**
 * An earlier version of a Media file, for opening or downloading from the file's page. Unlike
 * /api/media/:id this is not public: an old file was replaced on purpose and must not stay
 * reachable by anyone with its address. Always sent as a download, never cached.
 */
import { can, contentDisposition, toAccess } from '@ll/content';
import { mediaVersions } from '@ll/db/schema';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { DOCUMENT_HEADERS, UPLOAD_HEADERS } from '@/server/media-delivery';
import { isDocumentMime } from '@ll/content';

export const Route = createFileRoute('/api/media-versions/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });
        if (!can(toAccess(session.user), 'media:write')) {
          return new Response('Forbidden', { status: 403 });
        }

        const version = await getDb().query.mediaVersions.findFirst({
          where: eq(mediaVersions.id, params.id),
        });
        if (!version) return new Response('Not found', { status: 404 });
        const object = await env.MEDIA.get(version.r2Key);
        if (!object) return new Response('Not found', { status: 404 });

        return new Response(object.body, {
          headers: {
            'Content-Type': version.mime,
            'Content-Length': String(object.size),
            // Always a download, so it is never opened as a page from this origin.
            'Content-Disposition': contentDisposition(version.filename, 'attachment').replace(
              /^inline/,
              'attachment'
            ),
            'Cache-Control': 'private, no-store',
            ...(isDocumentMime(version.mime) ? DOCUMENT_HEADERS : UPLOAD_HEADERS),
          },
        });
      },
    },
  },
});

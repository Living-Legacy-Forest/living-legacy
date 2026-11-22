/**
 * A file in the Media trash, for its preview in the trash view. Unlike /api/media/:id this is not
 * public: a trashed file is off the website, so only people who can manage media see it. Takes
 * `?w=` like the public route. A document itself is sent as a download; its thumbnail is shown.
 * Never cached, so restoring or deleting it is reflected at once.
 */
import { can, contentDisposition, isDocumentMime, toAccess } from '@ll/content';
import { media } from '@ll/db/schema';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  DOCUMENT_HEADERS,
  UPLOAD_HEADERS,
  pickVariant,
  widthBucket,
} from '@/server/media-delivery';

export const Route = createFileRoute('/api/media-trash/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) return new Response('Unauthorized', { status: 401 });
        if (!can(toAccess(session.user), 'media:write')) {
          return new Response('Forbidden', { status: 403 });
        }

        const row = await getDb().query.media.findFirst({
          where: and(eq(media.id, params.id), isNotNull(media.deletedAt)),
        });
        if (!row) return new Response('Not found', { status: 404 });
        const variant = pickVariant(
          row.variants,
          widthBucket(new URL(request.url).searchParams.get('w'))
        );
        const object = await env.MEDIA.get(variant?.key ?? row.r2Key);
        if (!object) return new Response('Not found', { status: 404 });

        const isDocument = isDocumentMime(row.mime) && !variant;
        return new Response(object.body, {
          headers: {
            'Content-Type': variant?.mime ?? row.mime,
            'Content-Length': String(object.size),
            'Cache-Control': 'private, no-store',
            ...(isDocument
              ? {
                  ...DOCUMENT_HEADERS,
                  // Always a download, so it is never opened as a page from this origin.
                  'Content-Disposition': contentDisposition(row.filename, 'attachment').replace(
                    /^inline/,
                    'attachment'
                  ),
                }
              : UPLOAD_HEADERS),
          },
        });
      },
    },
  },
});

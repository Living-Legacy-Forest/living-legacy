/**
 * Serves an uploaded file. Deliberately public (no auth): the public website
 * loads images straight from here in plain <img> tags.
 */
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';

const { media } = schema;

export const Route = createFileRoute('/api/media/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const row = await getDb().query.media.findFirst({ where: eq(media.id, params.id) });
        if (!row) return new Response('Not found', { status: 404 });

        const object = await env.MEDIA.get(row.r2Key);
        if (!object) return new Response('Not found', { status: 404 });

        return new Response(object.body, {
          headers: {
            'Content-Type': row.mime,
            // Objects are never overwritten in place, so this is safe to cache hard.
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      },
    },
  },
});

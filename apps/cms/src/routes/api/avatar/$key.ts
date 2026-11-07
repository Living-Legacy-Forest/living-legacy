/**
 * Serves an uploaded avatar. Public, like /api/media/$id: avatars show up in
 * plain <img> tags. The avatar- prefix check keeps this from becoming a
 * generic proxy onto the rest of the bucket.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { UPLOAD_HEADERS } from '@/server/media-delivery';

export const Route = createFileRoute('/api/avatar/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!params.key.startsWith('avatar-')) return new Response('Not found', { status: 404 });

        const object = await env.MEDIA.get(params.key);
        if (!object) return new Response('Not found', { status: 404 });

        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...UPLOAD_HEADERS,
          },
        });
      },
    },
  },
});

/**
 * Serves an uploaded profile banner. Public, like /api/avatar/$key: banners show up in plain
 * <img> tags. The banner- prefix check keeps this from becoming a generic proxy onto the bucket.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { UPLOAD_HEADERS } from '@/server/media-delivery';

export const Route = createFileRoute('/api/banner/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!params.key.startsWith('banner-')) return new Response('Not found', { status: 404 });

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

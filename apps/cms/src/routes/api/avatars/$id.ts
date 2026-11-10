/**
 * The default face for someone without a photo (server/default-avatar.ts).
 * Public, like uploaded avatars: it shows in plain <img> tags. The same id
 * always draws the same face, so browsers keep it for good.
 */
import { createFileRoute } from '@tanstack/react-router';
import { defaultAvatarSvg, isAvatarSeed } from '@/server/default-avatar';
import { UPLOAD_HEADERS } from '@/server/media-delivery';

export const Route = createFileRoute('/api/avatars/$id')({
  server: {
    handlers: {
      GET: ({ params }) => {
        if (!isAvatarSeed(params.id)) return new Response('Not found', { status: 404 });
        return new Response(defaultAvatarSvg(params.id), {
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
            // An SVG from our own origin: never sniffed, never able to run anything.
            ...UPLOAD_HEADERS,
          },
        });
      },
    },
  },
});

/**
 * Upload. A raw handler rather than a server function, since a server
 * function's validator expects JSON and this receives multipart form data.
 */
import { type Role, can, imageSize } from '@ll/content';
import { schema } from '@ll/db';
import { type MediaVariant, maxImageSide, mediaVariantWidths } from '@ll/db/enums';
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

        // Sizes come from the file itself: the browser scales large images
        // down, but anything that skips that (an old tab, a script) must not
        // store a 6000px original for the website to serve.
        const bytes = new Uint8Array(await file.arrayBuffer());
        const measured = imageSize(bytes);
        if (!measured) {
          return Response.json({ error: 'That image could not be read.' }, { status: 400 });
        }
        if (Math.max(measured.width, measured.height) > maxImageSide) {
          return Response.json(
            { error: `Images can be at most ${maxImageSide} pixels on the longest side.` },
            { status: 400 }
          );
        }
        // The browser's reading wins when it is the same size turned: a JPEG's
        // header ignores the EXIF rotation the browser applies.
        const dimension = (key: string) => {
          const n = Number(form.get(key));
          return Number.isInteger(n) && n > 0 ? n : null;
        };
        const reported = { width: dimension('width'), height: dimension('height') };
        const { width, height } =
          (reported.width === measured.width && reported.height === measured.height) ||
          (reported.width === measured.height && reported.height === measured.width)
            ? (reported as { width: number; height: number })
            : measured;

        const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined;
        const base = crypto.randomUUID();
        // Under media/ so these can be told apart from avatars in the bucket.
        const r2Key = `media/${base}${ext ? `.${ext}` : ''}`;

        // Smaller copies made in the browser. One that is not actually smaller
        // than the original, or not the width it claims, is dropped.
        const sizes: { variant: MediaVariant; bytes: Uint8Array }[] = [];
        for (const w of mediaVariantWidths) {
          const copy = form.get(`size-${w}`);
          if (!(copy instanceof File) || !ALLOWED_MIME.has(copy.type)) continue;
          if (copy.type === 'image/gif' || copy.size >= file.size || w >= width) continue;
          const copyBytes = new Uint8Array(await copy.arrayBuffer());
          if (imageSize(copyBytes)?.width !== w) continue;
          const key = `media/${base}-w${w}.${copy.type.split('/')[1]!.replace('jpeg', 'jpg')}`;
          sizes.push({ variant: { width: w, key, mime: copy.type }, bytes: copyBytes });
        }

        const keys = [r2Key, ...sizes.map((s) => s.variant.key)];
        try {
          await Promise.all([
            env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: file.type } }),
            ...sizes.map((s) =>
              env.MEDIA.put(s.variant.key, s.bytes, {
                httpMetadata: { contentType: s.variant.mime },
              })
            ),
          ]);
        } catch (error) {
          await env.MEDIA.delete(keys).catch(() => {});
          throw error;
        }

        // Without a row nothing points at the files, so they go too. Anything
        // this misses is cleared by the daily sweep (server/media-sweep.ts).
        const row = await getDb()
          .insert(media)
          .values({
            r2Key,
            filename: file.name || r2Key,
            mime: file.type,
            size: file.size,
            width,
            height,
            variants: sizes.length ? sizes.map((s) => s.variant) : null,
            uploadedBy: session.user.id,
          })
          .returning()
          .then((rows) => rows[0])
          .catch((error: unknown) => {
            console.error('[media] could not save the upload', error);
            return undefined;
          });
        if (!row) {
          await env.MEDIA.delete(keys).catch(() => {});
          return Response.json({ error: 'Could not save the upload.' }, { status: 500 });
        }

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

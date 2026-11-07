/**
 * Serves uploaded files at /api/media/:id, ahead of the app router. Public
 * (no auth): the website loads images straight from here in plain <img> tags.
 *
 * `?w=640` asks for the image at (at least) that width: the smallest stored
 * copy that is wide enough, or the original. Requested widths snap to the
 * copies that can exist, so each image has a few cache entries, not one per
 * number someone types.
 *
 * Responses are kept in the edge cache of the data centre that served them,
 * so repeat views skip the database lookup and the R2 read.
 */
import { type MediaVariant, mediaVariantWidths } from '@ll/db/enums';
import { media } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';

const MEDIA_PATH = /^\/api\/media\/([\w-]+)$/;

// Objects are never overwritten in place, so browsers may keep them for good.
const BROWSER_CACHE = 'public, max-age=31536000, immutable';
// The edge keeps a copy for a day, so a deleted image stops being served
// everywhere within that time (deleting also clears the local copy at once).
const EDGE_CACHE = 'public, max-age=86400';

/** The id in an /api/media/:id path, or null for any other path. */
export function mediaIdFromPath(pathname: string): string | null {
  return MEDIA_PATH.exec(pathname)?.[1] ?? null;
}

/** The copy width a requested `?w=` maps to, or null for the original. */
function widthBucket(requested: string | null): number | null {
  const w = Number(requested);
  if (!requested || !Number.isFinite(w) || w <= 0) return null;
  return mediaVariantWidths.find((v) => w <= v) ?? null;
}

/** The smallest stored copy at least `bucket` wide, if any. */
function pickVariant(variants: MediaVariant[] | null, bucket: number | null): MediaVariant | null {
  if (bucket === null || !variants) return null;
  return variants.filter((v) => v.width >= bucket).sort((a, b) => a.width - b.width)[0] ?? null;
}

const cacheKey = (origin: string, id: string, bucket: number | null) =>
  new Request(`${origin}/api/media/${id}${bucket === null ? '' : `?w=${bucket}`}`);

// The browser's CacheStorage type wins in this project's types, and it has no
// `default`; the Workers runtime does.
const edgeCache = () => (caches as unknown as { default: Cache }).default;

export async function serveMedia(
  request: Request,
  id: string,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const url = new URL(request.url);
  const key = cacheKey(url.origin, id, widthBucket(url.searchParams.get('w')));
  const cache = edgeCache();
  const hit = await cache.match(key);
  if (hit) return withBrowserCache(hit, request);

  const row = await getDb().query.media.findFirst({ where: eq(media.id, id) });
  if (!row) return new Response('Not found', { status: 404 });
  const variant = pickVariant(row.variants, widthBucket(url.searchParams.get('w')));
  const object = await env.MEDIA.get(variant?.key ?? row.r2Key);
  if (!object) return new Response('Not found', { status: 404 });

  const response = new Response(object.body, {
    headers: {
      'Content-Type': variant?.mime ?? row.mime,
      'Content-Length': String(object.size),
      'Cache-Control': EDGE_CACHE,
      ...UPLOAD_HEADERS,
    },
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return withBrowserCache(response, request);
}

/**
 * Uploaded bytes are served from the CMS's own origin, so they must never be
 * read as anything but the image type they were stored as: no sniffing, and a
 * policy that runs nothing should a file ever be opened as a page.
 */
export const UPLOAD_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
} as const;

/** Drops this data centre's cached copies of each id; others expire on their own. */
export async function forgetCachedMedia(origin: string, ids: string[]) {
  const buckets = [null, ...mediaVariantWidths];
  await Promise.allSettled(
    ids.flatMap((id) => buckets.map((b) => edgeCache().delete(cacheKey(origin, id, b))))
  );
}

function withBrowserCache(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', BROWSER_CACHE);
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers,
  });
}

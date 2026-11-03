import { env } from 'cloudflare:workers';

/** The storage key behind an avatar URL, or null for anything else. */
export function avatarKey(image: string | null | undefined): string | null {
  const match = image?.match(/^\/api\/avatar\/(avatar-[^/]+)$/);
  return match?.[1] ?? null;
}

/**
 * Deletes the stored file behind a user's avatar URL. user.image is
 * client-settable (Better Auth's own /update-user), so it could point at
 * someone else's object; only delete what was tagged as this user's own.
 */
export async function deleteOwnAvatar(image: string | null | undefined, userId: string) {
  const key = avatarKey(image);
  if (!key) return;
  const object = await env.MEDIA.head(key);
  if (object?.customMetadata?.userId === userId) await env.MEDIA.delete(key);
}

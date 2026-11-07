import { type Role, can } from '@ll/content';

/**
 * What the signed-in person may do here. `full` edits and publishes; `author`
 * edits and submits for review; `seo` changes only the search listing;
 * `readonly` looks.
 */
export type PostAccess = 'full' | 'author' | 'seo' | 'readonly';

/**
 * Access for a person on a post; `createdBy` is null for a new post. Authors
 * cannot change a scheduled post: it goes live as the publisher approved it.
 */
export function postAccessFor(
  user: { id: string; role: Role },
  createdBy: string | null,
  scheduled = false
): PostAccess {
  if (can(user.role, 'posts:publish')) return 'full';
  if (
    can(user.role, 'posts:write') &&
    !scheduled &&
    (createdBy === null || createdBy === user.id)
  ) {
    return 'author';
  }
  return can(user.role, 'seo:write') ? 'seo' : 'readonly';
}

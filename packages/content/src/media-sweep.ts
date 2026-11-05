/**
 * Clearing out stored files that no media row or avatar points at, left
 * behind when an upload or delete fails part way.
 */

/** Uploads store their files before the row exists; give them this long to finish. */
const GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Above this share of the bucket, "orphaned" more likely means the list of
 * referenced keys came back wrong, so nothing is deleted.
 */
const MAX_ORPHAN_SHARE = 0.5;

export function findOrphans(
  objects: { key: string; uploaded: Date }[],
  referenced: Set<string>,
  now: Date
): { orphans: string[]; refused: boolean } {
  const orphans = objects
    .filter((o) => !referenced.has(o.key) && now.getTime() - o.uploaded.getTime() > GRACE_MS)
    .map((o) => o.key);
  if (orphans.length > objects.length * MAX_ORPHAN_SHARE) return { orphans: [], refused: true };
  return { orphans, refused: false };
}

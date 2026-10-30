/**
 * Indexing is opt-in by host.
 *
 * Only the production domain may be indexed. Every other host the Worker can be
 * reached on — workers.dev, preview versions, branch deploys, local dev — is
 * blocked automatically, so a preview URL can never be indexed by accident and
 * there is no flag anyone has to remember to set.
 */
export const CANONICAL_HOST = 'livinglegacy.com.au';

export function isIndexableHost(host: string | undefined | null): boolean {
  if (!host) return false;

  // Strip any port, and ignore case: Host headers are not normalised for us.
  const hostname = host.toLowerCase().split(':')[0];

  return hostname === CANONICAL_HOST || hostname === `www.${CANONICAL_HOST}`;
}

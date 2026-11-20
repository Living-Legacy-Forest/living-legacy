import { getAiStatus } from '@/server/ai';

/**
 * Whether the Suggest buttons show, as last seen by the browser, so changing pages does not wait
 * on a request. Keyed by user, so signing in as someone else asks again.
 */
let seen: { userId: string; enabled: boolean } | undefined;

export async function getCachedAiEnabled(userId: string): Promise<boolean> {
  if (seen?.userId === userId) return seen.enabled;
  const { enabled } = await getAiStatus();
  if (typeof window !== 'undefined') seen = { userId, enabled };
  return enabled;
}

/** Asks again on the next page change: after an admin turns the assistant on or off in Settings. */
export function forgetCachedAiEnabled() {
  seen = undefined;
}

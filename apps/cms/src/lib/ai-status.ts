import type { AiGroup } from '@ll/content';
import { getAiStatus } from '@/server/ai';

export type AiAccess = { enabled: boolean; groups: Record<AiGroup, boolean> };

/**
 * Whether the Suggest buttons show, and which kinds, as last seen by the browser, so changing
 * pages does not wait on a request. Keyed by user, so signing in as someone else asks again.
 */
let seen: { userId: string; access: AiAccess } | undefined;

export async function getCachedAiAccess(userId: string): Promise<AiAccess> {
  if (seen?.userId === userId) return seen.access;
  const { enabled, groups } = await getAiStatus();
  const access = { enabled, groups };
  if (typeof window !== 'undefined') seen = { userId, access };
  return access;
}

/** Asks again on the next page change: after an admin changes the assistant in Settings. */
export function forgetCachedAiEnabled() {
  seen = undefined;
}

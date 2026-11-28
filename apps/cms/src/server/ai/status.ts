import type { Access } from '@ll/content';
import type { Db } from '@ll/db';
import { env } from 'cloudflare:workers';
import { canSuggest } from './client';
import { loadAssistantSettings } from './usage';

/**
 * What the CMS shows about the writing assistant. `enabled` decides whether this person sees the
 * Suggest buttons. `keySet` and `switchedOn` say why they are missing, for the Settings page; they
 * are yes or no only, and the key itself never leaves the server.
 */
export async function assistantStatusFor(db: Db, access: Access) {
  const { enabled: switchedOn, groups } = await loadAssistantSettings(db);
  const keySet = Boolean(env.ANTHROPIC_API_KEY);
  return { enabled: keySet && switchedOn && canSuggest(access), keySet, switchedOn, groups };
}

import Anthropic from '@anthropic-ai/sdk';
import { type Permission, type Role, can } from '@ll/content';
import { env } from 'cloudflare:workers';
import type { AiClient } from './run';

/** The permissions that let someone edit something the assistant writes for. Everyone but a viewer. */
export const SUGGEST_PERMISSIONS: readonly Permission[] = [
  'posts:write',
  'seo:write',
  'content:write',
  'media:write',
];

/** The model client, or null when no key is set: then nothing asks for suggestions. */
export function getAiClient(): AiClient | null {
  const apiKey = env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

/** Whether to show the Suggest buttons to someone in this role. The key is never sent to the browser. */
export function aiEnabled(role: Role): boolean {
  return Boolean(env.ANTHROPIC_API_KEY) && canSuggest(role);
}

export function canSuggest(role: Role): boolean {
  return SUGGEST_PERMISSIONS.some((permission) => can(role, permission));
}

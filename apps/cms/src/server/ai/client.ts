import Anthropic from '@anthropic-ai/sdk';
import { type Access, type Permission, can } from '@ll/content';
import { env } from 'cloudflare:workers';
import type { AiClient } from './run';

/** The permissions that let someone edit something the assistant writes for. Anyone with one of these can use it. */
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

export function canSuggest(access: Access): boolean {
  return SUGGEST_PERMISSIONS.some((permission) => can(access, permission));
}

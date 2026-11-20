// The writing assistant: suggestions for post fields, image alt text and brand fixes. Each one
// only suggests; the editor accepts it in the form and saves as usual. Nothing here writes.
import { BRAND_RULES, type BrandRule, type Role, can } from '@ll/content';
import type { Db } from '@ll/db';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import brandGuide from '../../../../docs/brand-language.md?raw';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { loadAltImage } from './ai/alt-image';
import { aiEnabled, canSuggest, getAiClient } from './ai/client';
import { type AiClient, SuggestError, runSuggestion } from './ai/run';
import { loadContentTargets } from './post-score';

export { aiEnabled } from './ai/client';

const NOT_ALLOWED = 'You do not have permission to do that.';
const NOT_SET_UP = "The writing assistant isn't set up.";
const MAX_TAGS = 5;

const textReply = z.object({ text: z.string() });
const tagsReply = z.object({ tags: z.array(z.string()) });

async function brandRules(db: Db): Promise<readonly BrandRule[]> {
  return (await loadContentTargets(db)).brandRules ?? BRAND_RULES;
}

// ---------------------------------------------------------------------------
// Post fields

export const postFieldSchema = z.object({
  field: z.enum(['seoTitle', 'seoDescription', 'excerpt', 'focusKeyword', 'tags']),
  title: z.string().max(300),
  excerpt: z.string().max(500),
  bodyMarkdown: z.string().max(200_000),
  /** The tags that already exist; a suggestion for tags may only use these. */
  tagNames: z.array(z.string().max(60)).max(500),
});
export type PostFieldInput = z.infer<typeof postFieldSchema>;

export async function suggestPostFieldFor(
  db: Db,
  client: AiClient | null,
  role: Role,
  input: PostFieldInput
): Promise<{ text: string } | { tags: string[] }> {
  if (!canSuggest(role)) throw new SuggestError(NOT_ALLOWED);
  if (!client) throw new SuggestError(NOT_SET_UP);
  if (![input.title, input.excerpt, input.bodyMarkdown].some((part) => part.trim())) {
    throw new SuggestError('Write some of the post first.');
  }

  const lines = [
    `Title: ${input.title}`,
    `Summary: ${input.excerpt}`,
    '',
    'Post:',
    input.bodyMarkdown,
  ];
  if (input.field === 'tags') lines.push('', `Existing tags: ${input.tagNames.join(', ')}`);
  const content = [{ type: 'text' as const, text: lines.join('\n') }];
  const rules = await brandRules(db);

  if (input.field === 'tags') {
    const out = await runSuggestion(client, {
      field: 'tags',
      brandGuide,
      rules,
      content,
      schema: tagsReply,
      texts: (reply) => reply.tags,
      allowed: input.tagNames,
    });
    const known = new Map(input.tagNames.map((name) => [name.toLowerCase(), name]));
    const tags = [...new Set(out.tags.map((tag) => known.get(tag.trim().toLowerCase())))].filter(
      (tag): tag is string => Boolean(tag)
    );
    return { tags: tags.slice(0, MAX_TAGS) };
  }

  const out = await runSuggestion(client, {
    field: input.field,
    brandGuide,
    rules,
    content,
    schema: textReply,
    texts: (reply) => [reply.text],
  });
  return { text: out.text.trim() };
}

export const suggestPostField = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(postFieldSchema)
  .handler(({ data, context }) =>
    suggestPostFieldFor(getDb(), getAiClient(), context.user.role, data)
  );

// ---------------------------------------------------------------------------
// Alt text

export async function suggestAltTextFor(
  db: Db,
  bucket: R2Bucket,
  client: AiClient | null,
  role: Role,
  input: { mediaId: string }
): Promise<{ text: string }> {
  if (!can(role, 'media:write')) throw new SuggestError(NOT_ALLOWED);
  if (!client) throw new SuggestError(NOT_SET_UP);

  const { block, caption } = await loadAltImage(db, bucket, input.mediaId);
  const out = await runSuggestion(client, {
    field: 'alt',
    brandGuide,
    rules: await brandRules(db),
    content: [
      block,
      { type: 'text', text: caption ? `Its caption: ${caption}` : 'Describe this image.' },
    ],
    schema: textReply,
    texts: (reply) => [reply.text],
  });
  return { text: out.text.trim() };
}

export const suggestAltText = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(z.object({ mediaId: z.string() }))
  .handler(({ data, context }) =>
    suggestAltTextFor(getDb(), env.MEDIA, getAiClient(), context.user.role, data)
  );

// ---------------------------------------------------------------------------
// Brand fixes

export const brandFixSchema = z.object({
  text: z.string().max(2000),
  found: z.string().max(100),
  limit: z.number().int().min(1).max(2000),
});

export async function suggestBrandFixFor(
  db: Db,
  client: AiClient | null,
  role: Role,
  input: z.infer<typeof brandFixSchema>
): Promise<{ text: string }> {
  if (!canSuggest(role)) throw new SuggestError(NOT_ALLOWED);
  if (!client) throw new SuggestError(NOT_SET_UP);

  const out = await runSuggestion(client, {
    field: 'brandFix',
    brandGuide,
    rules: await brandRules(db),
    content: [
      { type: 'text', text: `Flagged: "${input.found}"\n\nText to rewrite:\n${input.text}` },
    ],
    schema: textReply,
    texts: (reply) => [reply.text],
    limit: input.limit,
  });
  return { text: out.text.trim() };
}

export const suggestBrandFix = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(brandFixSchema)
  .handler(({ data, context }) =>
    suggestBrandFixFor(getDb(), getAiClient(), context.user.role, data)
  );

// ---------------------------------------------------------------------------
// Whether to show the buttons

export const getAiStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => ({ enabled: aiEnabled(context.user.role) }));

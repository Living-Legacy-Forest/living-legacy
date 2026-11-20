// The writing assistant's logic: suggestions for post fields, image alt text and brand fixes. Each
// one only suggests; the editor accepts it in the form and saves as usual. Nothing here writes.
// Server only. src/server/ai.ts holds the server functions that call these; the logic lives here
// so the browser build never has to resolve what it imports.
import { BRAND_RULES, type Access, type BrandRule, can, toTags } from '@ll/content';
import type { Db } from '@ll/db';
import { z } from 'zod';
import brandGuide from '../../../../../docs/brand-language.md?raw';
import { listMediaTags } from '../media-list';
import { loadContentTargets } from '../post-score';
import { loadAltImage } from './alt-image';
import { canSuggest } from './client';
import { guardProblems } from './guard';
import { type AiClient, SuggestError, runSuggestion } from './run';
import type { BrandFixInput, PostFieldInput } from './schemas';
import { recordUsage, reserveSuggestion } from './usage';

/** Who is asking: their access decides what they may do, and their id is what the daily limit counts. */
export type Actor = { id: string } & Access;

const NOT_ALLOWED = 'You do not have permission to do that.';
const NOT_SET_UP = "The writing assistant isn't set up.";
const MAX_TAGS = 5;
const TAG_LIMIT = 60;
/** What the library stores for a tag (the Media server function's own limit). */
const MEDIA_TAG_LIMIT = 40;
const NO_IMAGE_TAGS = "Couldn't find tags that fit this image. Choose them yourself.";
const NO_TAGS = "Couldn't find tags that fit this post. Choose them yourself.";
/**
 * How much of a post is sent. Plenty for a search title, summary or tags (the opening says what a
 * post is about), and it keeps a very long post from costing many times a normal one.
 */
const POST_CHARS = 12_000;

const textReply = z.object({ text: z.string() });
const tagsReply = z.object({ tags: z.array(z.string()) });

async function brandRules(db: Db): Promise<readonly BrandRule[]> {
  return (await loadContentTargets(db)).brandRules ?? BRAND_RULES;
}

// ---------------------------------------------------------------------------
// Post fields

export async function suggestPostFieldFor(
  db: Db,
  client: AiClient | null,
  actor: Actor,
  input: PostFieldInput
): Promise<{ text: string } | { tags: string[] }> {
  if (!canSuggest(actor)) throw new SuggestError(NOT_ALLOWED);
  if (!client) throw new SuggestError(NOT_SET_UP);
  if (![input.title, input.excerpt, input.bodyMarkdown].some((part) => part.trim())) {
    throw new SuggestError('Write some of the post first.');
  }

  const lines = [
    `Title: ${input.title}`,
    `Summary: ${input.excerpt}`,
    '',
    'Post:',
    input.bodyMarkdown.length > POST_CHARS
      ? `${input.bodyMarkdown.slice(0, POST_CHARS)}\n\n(The post continues; only its start is shown.)`
      : input.bodyMarkdown,
  ];
  if (input.field === 'tags') lines.push('', `Existing tags: ${input.tagNames.join(', ')}`);
  const content = [{ type: 'text' as const, text: lines.join('\n') }];
  const rules = await brandRules(db);
  await reserveSuggestion(db, actor.id);

  if (input.field === 'tags') {
    // Tags are picked from the list, not written, so one bad pick is dropped rather than failing
    // (and paying for) the whole reply again.
    const out = await runSuggestion(client, {
      onDone: (result) => recordUsage(db, actor.id, result),
      field: 'tags',
      brandGuide,
      rules,
      content,
      schema: tagsReply,
      texts: () => [],
    });
    const known = new Map(input.tagNames.map((name) => [name.toLowerCase(), name]));
    const tags = [...new Set(out.tags.map((tag) => known.get(tag.trim().toLowerCase())))].filter(
      (tag): tag is string =>
        Boolean(tag) && guardProblems(tag!, { limit: TAG_LIMIT, rules }).length === 0
    );
    if (tags.length === 0) throw new SuggestError(NO_TAGS);
    return { tags: tags.slice(0, MAX_TAGS) };
  }

  const out = await runSuggestion(client, {
    onDone: (result) => recordUsage(db, actor.id, result),
    field: input.field,
    brandGuide,
    rules,
    content,
    schema: textReply,
    texts: (reply) => [reply.text],
  });
  return { text: out.text.trim() };
}

// ---------------------------------------------------------------------------
// Images: alt text, caption and tags

type MediaInput = { mediaId: string };

/** What every image suggestion needs first: permission, a client, and the picture itself. */
async function openImage(
  db: Db,
  bucket: R2Bucket,
  client: AiClient | null,
  actor: Actor,
  input: MediaInput
) {
  if (!can(actor, 'media:write')) throw new SuggestError(NOT_ALLOWED);
  if (!client) throw new SuggestError(NOT_SET_UP);
  return { client, ...(await loadAltImage(db, bucket, input.mediaId)) };
}

async function suggestImageText(
  field: 'alt' | 'caption',
  db: Db,
  bucket: R2Bucket,
  client: AiClient | null,
  actor: Actor,
  input: MediaInput
): Promise<{ text: string }> {
  const image = await openImage(db, bucket, client, actor, input);
  await reserveSuggestion(db, actor.id);
  const out = await runSuggestion(image.client, {
    onDone: (result) => recordUsage(db, actor.id, result),
    field,
    brandGuide,
    rules: await brandRules(db),
    content: [
      image.block,
      {
        type: 'text',
        // An alt text is written knowing the caption; a caption is written from the picture.
        text:
          field === 'alt' && image.caption
            ? `Its caption: ${image.caption}`
            : 'Describe this image.',
      },
    ],
    schema: textReply,
    texts: (reply) => [reply.text],
  });
  return { text: out.text.trim() };
}

export const suggestAltTextFor = (
  db: Db,
  bucket: R2Bucket,
  client: AiClient | null,
  actor: Actor,
  input: MediaInput
) => suggestImageText('alt', db, bucket, client, actor, input);

export const suggestMediaCaptionFor = (
  db: Db,
  bucket: R2Bucket,
  client: AiClient | null,
  actor: Actor,
  input: MediaInput
) => suggestImageText('caption', db, bucket, client, actor, input);

/**
 * Labels for finding an image in the library, tidied the way the library stores them. The tags
 * already in use are passed along so the model reuses them instead of inventing near-duplicates.
 */
export async function suggestMediaTagsFor(
  db: Db,
  bucket: R2Bucket,
  client: AiClient | null,
  actor: Actor,
  input: MediaInput
): Promise<{ tags: string[] }> {
  const image = await openImage(db, bucket, client, actor, input);
  await reserveSuggestion(db, actor.id);
  const rules = await brandRules(db);
  const used = (await listMediaTags(db)).map((row) => row.tag);

  const out = await runSuggestion(image.client, {
    onDone: (result) => recordUsage(db, actor.id, result),
    field: 'mediaTags',
    brandGuide,
    rules,
    content: [
      image.block,
      {
        type: 'text',
        text: used.length
          ? `Tags already used in the library: ${used.join(', ')}`
          : 'The library has no tags yet.',
      },
    ],
    schema: tagsReply,
    texts: () => [],
  });
  // Written the way the library stores them; a label that breaks the guide is dropped, not a
  // reason to ask (and pay) again.
  const tags = toTags(out.tags).filter(
    (tag) => guardProblems(tag, { limit: MEDIA_TAG_LIMIT, rules }).length === 0
  );
  if (tags.length === 0) throw new SuggestError(NO_IMAGE_TAGS);
  return { tags: tags.slice(0, MAX_TAGS) };
}

// ---------------------------------------------------------------------------
// Brand fixes

export async function suggestBrandFixFor(
  db: Db,
  client: AiClient | null,
  actor: Actor,
  input: BrandFixInput
): Promise<{ text: string }> {
  if (!canSuggest(actor)) throw new SuggestError(NOT_ALLOWED);
  if (!client) throw new SuggestError(NOT_SET_UP);
  await reserveSuggestion(db, actor.id);

  const out = await runSuggestion(client, {
    onDone: (result) => recordUsage(db, actor.id, result),
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

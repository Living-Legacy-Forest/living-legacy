/**
 * The CMS API (/api/v1): what a post looks like over the wire, and what a
 * client may send. Routes live in src/routes/api/v1; keys in lib/api-keys.ts.
 *
 * Writes create and edit drafts only. Publishing stays a person's decision in
 * the CMS, so nothing a script or AI writer sends goes live unreviewed.
 */
import {
  type PostInput,
  blogPath,
  markdownToRichText,
  postInputSchema,
  richTextSchema,
} from '@ll/content';
import type { Db } from '@ll/db';
import { z } from 'zod';
import type { ApiActor } from '@/lib/api-keys';
import { cmsOrigin } from '@/lib/email';
import { logActivity } from './activity-log';
import { type PostRow, liveInput, loadTermsFor } from './post-store';

const SITE_URL = 'https://livinglegacy.com.au';

export const API_PAGE_SIZE = 20;
export const API_MAX_PAGE_SIZE = 100;

type Status = 'draft' | 'scheduled' | 'published' | 'trashed';

function statusOf(row: PostRow): Status {
  if (row.deletedAt) return 'trashed';
  if (row.status === 'published') return 'published';
  return row.scheduledAt ? 'scheduled' : 'draft';
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

/** A post in a list: enough to find it, without its body. */
export function postSummary(row: PostRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: statusOf(row),
    excerpt: row.excerpt ?? '',
    hasUnpublishedChanges: row.draft !== null,
    publishedAt: iso(row.publishedAt),
    scheduledAt: iso(row.scheduledAt),
    updatedAt: iso(row.updatedAt),
    url: row.status === 'published' && !row.deletedAt ? `${SITE_URL}${blogPath(row.slug)}/` : null,
    editUrl: `${cmsOrigin()}/posts/${row.id}`,
  };
}

/**
 * A single post in full. For a published post with edits waiting, `content`
 * is the live version and `unpublishedChanges` the waiting one.
 */
export async function postDetail(db: Db, row: PostRow) {
  const live = await liveInput(db, row);
  const terms = await loadTermsFor(db, [row.id]);
  return {
    ...postSummary(row),
    content: {
      ...live,
      categories: terms
        .filter((t) => t.type === 'category')
        .map((t) => ({ id: t.id, name: t.name })),
    },
    unpublishedChanges: row.draft ? { ...live, ...(row.draft as Partial<PostInput>) } : null,
  };
}

// What a client may send. `markdown` is the easy way to supply a body; `body`
// takes the editor's own JSON. Fields left out keep their current value.
const writeFields = {
  title: z.string({ error: 'A title is required.' }).trim().min(1, 'A title is required.').max(200),
  slug: postInputSchema.shape.slug,
  excerpt: postInputSchema.shape.excerpt,
  markdown: z.string().max(200_000),
  body: richTextSchema.nullable(),
  tags: postInputSchema.shape.tags,
  categoryIds: postInputSchema.shape.categoryIds,
  seoTitle: postInputSchema.shape.seoTitle,
  seoDescription: postInputSchema.shape.seoDescription,
  noindex: postInputSchema.shape.noindex,
};

const oneBody = (v: { markdown?: string; body?: unknown }) =>
  v.markdown === undefined || v.body === undefined;
const oneBodyMessage = { message: 'Send either markdown or body, not both.' };

export const createPostSchema = z
  .object(writeFields)
  .partial()
  .extend({ title: writeFields.title })
  .strict()
  .refine(oneBody, oneBodyMessage);

export const updatePostSchema = z
  .object(writeFields)
  .partial()
  .strict()
  .refine(oneBody, oneBodyMessage);

/** Applies a create or update request on top of `base` editor input. */
export function applyWrite(base: PostInput, data: z.infer<typeof updatePostSchema>): PostInput {
  const { markdown, body, ...rest } = data;
  const next: PostInput = { ...base, ...rest };
  if (markdown !== undefined) next.body = markdownToRichText(markdown);
  else if (body !== undefined) next.body = body;
  return postInputSchema.parse(next);
}

/** First validation problem, phrased for an API client. */
export function describeIssues(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'The request is not valid.';
  const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${where}${issue.message}`;
}

/** Records an API write in the activity log, naming the key that made it. */
export function logApiWrite(
  db: Db,
  actor: ApiActor,
  action: 'post.created_via_api' | 'post.updated_via_api',
  title: string,
  /** The post is live, so the edits wait as unpublished changes. */
  live = false
) {
  const name = `"${title || 'Untitled'}"`;
  const summary =
    action === 'post.created_via_api'
      ? `Created the draft ${name} through the API`
      : live
        ? `Edited ${name} through the API; the changes are waiting to be published`
        : `Edited the draft ${name} through the API`;
  return logActivity(db, {
    actorId: actor.userId,
    actorName: `${actor.userName} (API key "${actor.keyName}")`,
    action,
    summary,
  });
}

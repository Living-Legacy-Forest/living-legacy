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
  emptyPostInput,
  markdownToRichText,
  postInputSchema,
  richTextSchema,
} from '@ll/content';
import type { Db } from '@ll/db';
import { posts, terms } from '@ll/db/schema';
import { type SQL, and, asc, count, desc, eq, isNotNull, isNull, like } from 'drizzle-orm';
import { ZodError, z } from 'zod';
import { type ApiActor, apiError } from '@/lib/api-keys';
import { cmsOrigin } from '@/lib/email';
import { logActivity } from './activity-log';
import { type PostRow, createDraft, liveInput, loadTermsFor, saveEdits } from './post-store';

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
export const writeFields = {
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

// ---------------------------------------------------------------------------
// The operations. The REST routes and the MCP server (src/server/mcp.ts) both
// call these, so the two can never disagree about what a key may do.

/** A request the API turns down: the HTTP status and a sentence for the client. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export const postStatusFilters = ['all', 'draft', 'scheduled', 'published', 'trashed'] as const;
export type PostStatusFilter = (typeof postStatusFilters)[number];

const statusWhere: Record<PostStatusFilter, SQL | undefined> = {
  // "all" leaves out the trash.
  all: isNull(posts.deletedAt),
  draft: and(isNull(posts.deletedAt), eq(posts.status, 'draft'), isNull(posts.scheduledAt)),
  scheduled: and(isNull(posts.deletedAt), eq(posts.status, 'draft'), isNotNull(posts.scheduledAt)),
  published: and(isNull(posts.deletedAt), eq(posts.status, 'published')),
  trashed: isNotNull(posts.deletedAt),
};

/** One page of posts, newest change first. */
export async function listPostsPage(
  db: Db,
  query: { status?: string; q?: string; page?: number; pageSize?: number }
) {
  const status = query.status ?? 'all';
  if (!(postStatusFilters as readonly string[]).includes(status)) {
    throw new ApiFailure(400, `status must be one of: ${postStatusFilters.join(', ')}.`);
  }
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1);
  const pageSize = Math.min(
    API_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(query.pageSize ?? API_PAGE_SIZE) || API_PAGE_SIZE)
  );
  const q = query.q?.trim().slice(0, 100);
  const where = and(
    statusWhere[status as PostStatusFilter],
    q ? like(posts.title, `%${q}%`) : undefined
  );

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(posts).where(where),
  ]);
  return { data: rows.map(postSummary), page, pageSize, total: total?.value ?? 0 };
}

const findPost = (db: Db, id: string) => db.query.posts.findFirst({ where: eq(posts.id, id) });

export async function getPost(db: Db, id: string) {
  const row = await findPost(db, id);
  if (!row) throw new ApiFailure(404, 'No post has that id.');
  return postDetail(db, row);
}

/** Creates a draft from a create request that has already passed `createPostSchema`. */
export async function createPostDraft(
  db: Db,
  actor: ApiActor,
  data: z.infer<typeof createPostSchema>
) {
  let input: PostInput;
  try {
    input = applyWrite(emptyPostInput, data);
  } catch (error) {
    throw new ApiFailure(400, invalidMessage(error));
  }
  const row = await createDraft(db, input, actor.userId);
  await logApiWrite(db, actor, 'post.created_via_api', row.title);
  return postDetail(db, row);
}

/**
 * Edits a post from a request that has already passed `updatePostSchema`.
 * A published post keeps its live version; the edits wait as unpublished
 * changes for someone to publish in the CMS.
 */
export async function updatePost(
  db: Db,
  actor: ApiActor,
  id: string,
  data: z.infer<typeof updatePostSchema>
) {
  const row = await findPost(db, id);
  if (!row) throw new ApiFailure(404, 'No post has that id.');
  if (row.deletedAt) {
    throw new ApiFailure(409, 'That post is in the trash. Restore it in the CMS first.');
  }
  // The cron job publishes a scheduled post's content as is, so an edit here
  // would go live without anyone reviewing it.
  if (row.scheduledAt && row.status !== 'published') {
    throw new ApiFailure(409, 'That post is scheduled. Unschedule it in the CMS first.');
  }

  // Edits build on whatever is waiting to be published, if anything.
  const live = await liveInput(db, row);
  const base = row.draft ? ({ ...live, ...row.draft } as PostInput) : live;

  try {
    await saveEdits(db, row, applyWrite(base, data), actor.userId);
  } catch (error) {
    if (error instanceof ZodError) throw new ApiFailure(400, describeIssues(error));
    throw new ApiFailure(409, error instanceof Error ? error.message : 'Could not save the post.');
  }

  await logApiWrite(
    db,
    actor,
    'post.updated_via_api',
    data.title ?? row.title,
    row.status === 'published'
  );
  return postDetail(db, (await findPost(db, id)) ?? row);
}

/** Categories and tags. Posts take category ids and tag names. */
export async function listTerms(db: Db) {
  const rows = await db
    .select({ id: terms.id, type: terms.type, name: terms.name, slug: terms.slug })
    .from(terms)
    .orderBy(asc(terms.name));
  return {
    categories: rows.filter((t) => t.type === 'category').map(({ type: _, ...t }) => t),
    tags: rows.filter((t) => t.type === 'tag').map(({ type: _, ...t }) => t),
  };
}

/** Runs an operation for a REST route, turning an `ApiFailure` into its JSON error. */
export async function respond(work: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    return Response.json(await work(), { status });
  } catch (error) {
    if (error instanceof ApiFailure) return apiError(error.status, error.message);
    throw error;
  }
}

function invalidMessage(error: unknown) {
  if (error instanceof ZodError) return describeIssues(error);
  return error instanceof Error ? error.message : 'The post is not valid.';
}

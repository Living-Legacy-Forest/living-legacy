/**
 * GET  /api/v1/posts  List posts, newest change first (read key).
 *      ?status=all|draft|scheduled|published|trashed (all leaves out trashed)
 *      ?q=words in the title  ?page=1  ?pageSize=20 (up to 100)
 * POST /api/v1/posts  Create a draft (write key). See src/server/api-v1.ts.
 */
import { emptyPostInput } from '@ll/content';
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { type SQL, and, count, desc, eq, isNotNull, isNull, like } from 'drizzle-orm';
import { apiError, authenticateApiRequest, readJson } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import {
  API_MAX_PAGE_SIZE,
  API_PAGE_SIZE,
  applyWrite,
  createPostSchema,
  describeIssues,
  logApiWrite,
  postDetail,
  postSummary,
} from '@/server/api-v1';
import { createDraft } from '@/server/post-store';

const { posts } = schema;

const statusFilters: Record<string, SQL | undefined> = {
  all: isNull(posts.deletedAt),
  draft: and(isNull(posts.deletedAt), eq(posts.status, 'draft'), isNull(posts.scheduledAt)),
  scheduled: and(isNull(posts.deletedAt), eq(posts.status, 'draft'), isNotNull(posts.scheduledAt)),
  published: and(isNull(posts.deletedAt), eq(posts.status, 'published')),
  trashed: isNotNull(posts.deletedAt),
};

export const Route = createFileRoute('/api/v1/posts/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const actor = await authenticateApiRequest(request, 'read');
        if (actor instanceof Response) return actor;

        const params = new URL(request.url).searchParams;
        const status = params.get('status') ?? 'all';
        if (!(status in statusFilters)) {
          return apiError(400, `status must be one of: ${Object.keys(statusFilters).join(', ')}.`);
        }
        const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
        const pageSize = Math.min(
          API_MAX_PAGE_SIZE,
          Math.max(1, Number.parseInt(params.get('pageSize') ?? '', 10) || API_PAGE_SIZE)
        );
        const q = params.get('q')?.trim().slice(0, 100);
        const where = and(statusFilters[status], q ? like(posts.title, `%${q}%`) : undefined);

        const db = getDb();
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
        return Response.json({
          data: rows.map(postSummary),
          page,
          pageSize,
          total: total?.value ?? 0,
        });
      },

      POST: async ({ request }) => {
        const actor = await authenticateApiRequest(request, 'write');
        if (actor instanceof Response) return actor;
        const body = await readJson(request);
        if (body instanceof Response) return body;

        const parsed = createPostSchema.safeParse(body);
        if (!parsed.success) return apiError(400, describeIssues(parsed.error));

        let input;
        try {
          input = applyWrite(emptyPostInput, parsed.data);
        } catch (error) {
          return apiError(400, error instanceof Error ? error.message : 'The post is not valid.');
        }

        const db = getDb();
        const row = await createDraft(db, input, actor.userId);
        await logApiWrite(db, actor, 'post.created_via_api', row.title);
        return Response.json(await postDetail(db, row), { status: 201 });
      },
    },
  },
});

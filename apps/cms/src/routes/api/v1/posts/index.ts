/**
 * GET  /api/v1/posts  List posts, newest change first (read key).
 *      ?status=all|draft|scheduled|published|trashed (all leaves out trashed)
 *      ?q=words in the title  ?page=1  ?pageSize=20 (up to 100)
 * POST /api/v1/posts  Create a draft (write key). See src/server/api-v1.ts.
 */
import { createFileRoute } from '@tanstack/react-router';
import { apiError, authenticateApiRequest, readJson } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import {
  createPostDraft,
  createPostSchema,
  describeIssues,
  listPostsPage,
  respond,
} from '@/server/api-v1';

const int = (value: string | null) => (value ? Number.parseInt(value, 10) : undefined);

export const Route = createFileRoute('/api/v1/posts/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const actor = await authenticateApiRequest(request, 'read');
        if (actor instanceof Response) return actor;
        const params = new URL(request.url).searchParams;
        return respond(() =>
          listPostsPage(getDb(), {
            status: params.get('status') ?? undefined,
            q: params.get('q') ?? undefined,
            page: int(params.get('page')),
            pageSize: int(params.get('pageSize')),
          })
        );
      },

      POST: async ({ request }) => {
        const actor = await authenticateApiRequest(request, 'write');
        if (actor instanceof Response) return actor;
        const body = await readJson(request);
        if (body instanceof Response) return body;

        const parsed = createPostSchema.safeParse(body);
        if (!parsed.success) return apiError(400, describeIssues(parsed.error));
        return respond(() => createPostDraft(getDb(), actor, parsed.data), 201);
      },
    },
  },
});

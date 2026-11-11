/**
 * GET   /api/v1/posts/:id  One post in full, body included (read key).
 * PATCH /api/v1/posts/:id  Edit it (write key). Only the fields sent change.
 *       A published post keeps its live version; the edits wait as
 *       unpublished changes for someone to publish in the CMS.
 */
import { createFileRoute } from '@tanstack/react-router';
import { apiError, authenticateApiRequest, readJson } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import { describeIssues, getPost, respond, updatePost, updatePostSchema } from '@/server/api-v1';

export const Route = createFileRoute('/api/v1/posts/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const actor = await authenticateApiRequest(request, 'read');
        if (actor instanceof Response) return actor;
        return respond(() => getPost(getDb(), params.id));
      },

      PATCH: async ({ request, params }) => {
        const actor = await authenticateApiRequest(request, 'write');
        if (actor instanceof Response) return actor;
        const body = await readJson(request);
        if (body instanceof Response) return body;

        const parsed = updatePostSchema.safeParse(body);
        if (!parsed.success) return apiError(400, describeIssues(parsed.error));
        return respond(() => updatePost(getDb(), actor, params.id, parsed.data));
      },
    },
  },
});

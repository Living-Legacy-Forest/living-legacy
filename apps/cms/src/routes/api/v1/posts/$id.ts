/**
 * GET   /api/v1/posts/:id  One post in full, body included (read key).
 * PATCH /api/v1/posts/:id  Edit it (write key). Only the fields sent change.
 *       A published post keeps its live version; the edits wait as
 *       unpublished changes for someone to publish in the CMS.
 */
import type { PostInput } from '@ll/content';
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { apiError, authenticateApiRequest, readJson } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import {
  applyWrite,
  describeIssues,
  logApiWrite,
  postDetail,
  updatePostSchema,
} from '@/server/api-v1';
import { liveInput, saveEdits } from '@/server/post-store';

const { posts } = schema;

const findPost = (id: string) => getDb().query.posts.findFirst({ where: eq(posts.id, id) });

export const Route = createFileRoute('/api/v1/posts/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const actor = await authenticateApiRequest(request, 'read');
        if (actor instanceof Response) return actor;
        const row = await findPost(params.id);
        if (!row) return apiError(404, 'No post has that id.');
        return Response.json(await postDetail(getDb(), row));
      },

      PATCH: async ({ request, params }) => {
        const actor = await authenticateApiRequest(request, 'write');
        if (actor instanceof Response) return actor;
        const body = await readJson(request);
        if (body instanceof Response) return body;

        const parsed = updatePostSchema.safeParse(body);
        if (!parsed.success) return apiError(400, describeIssues(parsed.error));

        const db = getDb();
        const row = await findPost(params.id);
        if (!row) return apiError(404, 'No post has that id.');
        if (row.deletedAt)
          return apiError(409, 'That post is in the trash. Restore it in the CMS first.');

        // Edits build on whatever is waiting to be published, if anything.
        const live = await liveInput(db, row);
        const base = row.draft ? ({ ...live, ...row.draft } as PostInput) : live;

        try {
          const values = applyWrite(base, parsed.data);
          await saveEdits(db, row, values, actor.userId);
        } catch (error) {
          if (error instanceof ZodError) return apiError(400, describeIssues(error));
          return apiError(409, error instanceof Error ? error.message : 'Could not save the post.');
        }

        await logApiWrite(
          db,
          actor,
          'post.updated_via_api',
          parsed.data.title ?? row.title,
          row.status === 'published'
        );
        const updated = await findPost(params.id);
        return Response.json(await postDetail(db, updated ?? row));
      },
    },
  },
});

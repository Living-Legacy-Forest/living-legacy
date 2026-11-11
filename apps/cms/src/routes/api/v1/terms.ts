/**
 * GET /api/v1/terms  Categories and tags (read key). Send category ids, and
 * tag names, when creating or editing a post; unknown tags are created.
 */
import { createFileRoute } from '@tanstack/react-router';
import { authenticateApiRequest } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import { listTerms, respond } from '@/server/api-v1';

export const Route = createFileRoute('/api/v1/terms')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const actor = await authenticateApiRequest(request, 'read');
        if (actor instanceof Response) return actor;
        return respond(() => listTerms(getDb()));
      },
    },
  },
});

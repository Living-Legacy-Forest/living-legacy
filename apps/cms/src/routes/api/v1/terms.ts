/**
 * GET /api/v1/terms  Categories and tags (read key). Send category ids, and
 * tag names, when creating or editing a post; unknown tags are created.
 */
import { schema } from '@ll/db';
import { createFileRoute } from '@tanstack/react-router';
import { asc } from 'drizzle-orm';
import { authenticateApiRequest } from '@/lib/api-keys';
import { getDb } from '@/lib/db';

const { terms } = schema;

export const Route = createFileRoute('/api/v1/terms')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const actor = await authenticateApiRequest(request, 'read');
        if (actor instanceof Response) return actor;
        const rows = await getDb()
          .select({ id: terms.id, type: terms.type, name: terms.name, slug: terms.slug })
          .from(terms)
          .orderBy(asc(terms.name));
        return Response.json({
          categories: rows.filter((t) => t.type === 'category').map(({ type: _, ...t }) => t),
          tags: rows.filter((t) => t.type === 'tag').map(({ type: _, ...t }) => t),
        });
      },
    },
  },
});

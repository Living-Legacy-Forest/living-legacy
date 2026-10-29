import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';

const { redirects } = schema;

const fromPathSchema = z
  .string()
  .trim()
  .regex(/^\/\S*$/, 'The old path must start with a slash, like /old-page.');
const toPathSchema = z
  .string()
  .trim()
  .regex(
    /^(\/\S*|https?:\/\/\S+)$/,
    'The destination must be a path like /new-page or a full URL.'
  );

export const listRedirects = createServerFn({ method: 'GET' })
  .middleware([requirePermission('redirects:write')])
  .handler(async () => {
    const rows = await getDb()
      .select({
        id: redirects.id,
        fromPath: redirects.fromPath,
        toPath: redirects.toPath,
        statusCode: redirects.statusCode,
        hits: redirects.hits,
        note: redirects.note,
        createdAt: redirects.createdAt,
      })
      .from(redirects)
      .orderBy(desc(redirects.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
  });

export type RedirectsData = Awaited<ReturnType<typeof listRedirects>>;
export type Redirect = RedirectsData[number];

const redirectSchema = z.object({
  id: z.string().optional(),
  fromPath: fromPathSchema,
  toPath: toPathSchema,
  statusCode: z.union([z.literal(301), z.literal(302)]),
  note: z.string().trim().max(200).optional(),
});

export const saveRedirect = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(redirectSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const note = data.note || null;

    // from_path is unique: give a clear message instead of a constraint error.
    const clash = await db.query.redirects.findFirst({
      where: eq(redirects.fromPath, data.fromPath),
    });
    if (clash && clash.id !== data.id) {
      throw new Error(`${data.fromPath} is already redirected.`);
    }

    if (!data.id) {
      const [row] = await db
        .insert(redirects)
        .values({
          fromPath: data.fromPath,
          toPath: data.toPath,
          statusCode: data.statusCode,
          note,
        })
        .returning({ id: redirects.id });
      return { id: row!.id };
    }

    await db
      .update(redirects)
      .set({
        fromPath: data.fromPath,
        toPath: data.toPath,
        statusCode: data.statusCode,
        note,
        updatedAt: new Date(),
      })
      .where(eq(redirects.id, data.id));
    return { id: data.id };
  });

export const deleteRedirect = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(redirects).where(eq(redirects.id, data.id));
  });

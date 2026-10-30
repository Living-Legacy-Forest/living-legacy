import { type RedirectRule, isWildcard, redirectStatusCodes, traceRedirect } from '@llf/content';
import { schema } from '@llf/db';
import { createServerFn } from '@tanstack/react-start';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { type BulkResult, firstIssue } from '@/lib/bulk-import';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';

const { redirects } = schema;

/** The public website, checked so a redirect does not hide a page that still exists. */
const SITE_URL = 'https://livinglegacyforest.com.au';

const fromPathSchema = z
  .string()
  .trim()
  .regex(/^\/\S*$/, 'The old path must start with a slash, like /old-page.')
  .refine(
    (path) => !path.slice(0, -1).includes('*'),
    'A * can only go at the end of the old path, like /blog/*.'
  );
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
        enabled: redirects.enabled,
        keepQuery: redirects.keepQuery,
        hits: redirects.hits,
        lastHitAt: redirects.lastHitAt,
        note: redirects.note,
        createdAt: redirects.createdAt,
      })
      .from(redirects)
      .orderBy(desc(redirects.createdAt));
    return rows.map((r) => ({
      ...r,
      lastHitAt: r.lastHitAt?.getTime() ?? null,
      createdAt: r.createdAt.getTime(),
    }));
  });

export type RedirectsData = Awaited<ReturnType<typeof listRedirects>>;
export type Redirect = RedirectsData[number];

const redirectSchema = z
  .object({
    id: z.string().optional(),
    fromPath: fromPathSchema,
    toPath: z.string().trim(),
    statusCode: z.union(redirectStatusCodes.map((code) => z.literal(code))),
    enabled: z.boolean(),
    keepQuery: z.boolean(),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    // A removed (410) path has no destination.
    if (data.statusCode === 410) return;
    const result = toPathSchema.safeParse(data.toPath);
    if (!result.success) {
      ctx.addIssue({ code: 'custom', path: ['toPath'], message: result.error.issues[0]!.message });
    }
    if (data.toPath.includes('*') && !isWildcard(data.fromPath)) {
      ctx.addIssue({
        code: 'custom',
        path: ['toPath'],
        message: 'A * in the destination needs a * at the end of the old path too.',
      });
    }
  });

/** Whether the path is a page on the live website, so the redirect would hide it. */
async function isLivePage(fromPath: string): Promise<boolean> {
  if (isWildcard(fromPath)) return false;
  try {
    const res = await fetch(new URL(fromPath, SITE_URL), {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Problems worth knowing about that do not stop the save. */
async function redirectWarnings(rule: RedirectRule, others: RedirectRule[]): Promise<string[]> {
  const warnings: string[] = [];
  const trace = traceRedirect(others, rule);
  if (trace.gone) {
    warnings.push(`${rule.toPath} is marked as removed, so visitors will land on a gone page.`);
  } else if (trace.hops.length > 0) {
    const end = trace.hops[trace.hops.length - 1];
    warnings.push(`${rule.toPath} redirects again, to ${end}. Point straight at ${end} instead.`);
  }
  if (await isLivePage(rule.fromPath)) {
    warnings.push(`${rule.fromPath} is a live page on the website. This redirect will hide it.`);
  }
  return warnings;
}

export const saveRedirect = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(redirectSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const note = data.note || null;
    const toPath = data.statusCode === 410 ? '' : data.toPath;

    // from_path is unique: give a clear message instead of a constraint error.
    const clash = await db.query.redirects.findFirst({
      where: eq(redirects.fromPath, data.fromPath),
    });
    if (clash && clash.id !== data.id) {
      throw new Error(`${data.fromPath} is already redirected.`);
    }

    const rule: RedirectRule = { ...data, id: data.id ?? 'new', toPath };
    const others = (
      await db
        .select({
          id: redirects.id,
          fromPath: redirects.fromPath,
          toPath: redirects.toPath,
          statusCode: redirects.statusCode,
          keepQuery: redirects.keepQuery,
        })
        .from(redirects)
        .where(eq(redirects.enabled, true))
    ).filter((r) => r.id !== data.id);
    if (data.enabled && traceRedirect(others, rule).loop) {
      throw new Error(`This would send visitors round in a loop. Check where ${toPath} goes.`);
    }
    const warnings = data.enabled ? await redirectWarnings(rule, others) : [];

    if (!data.id) {
      const [row] = await db
        .insert(redirects)
        .values({
          fromPath: data.fromPath,
          toPath,
          statusCode: data.statusCode,
          enabled: data.enabled,
          keepQuery: data.keepQuery,
          note,
        })
        .returning({ id: redirects.id });
      return { id: row!.id, warnings };
    }

    await db
      .update(redirects)
      .set({
        fromPath: data.fromPath,
        toPath,
        statusCode: data.statusCode,
        enabled: data.enabled,
        keepQuery: data.keepQuery,
        note,
        updatedAt: new Date(),
      })
      .where(eq(redirects.id, data.id));
    return { id: data.id, warnings };
  });

export const deleteRedirect = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(redirects).where(eq(redirects.id, data.id));
  });

export const deleteRedirects = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await getDb().delete(redirects).where(inArray(redirects.id, data.ids));
    return { removed: data.ids.length };
  });

/** D1 caps bound parameters per statement, so new rows are inserted a few at a time. */
const INSERT_CHUNK = 10;

/** Adds rows without an id and updates rows with one, from a CSV upload. */
export const importRedirects = createServerFn({ method: 'POST' })
  .middleware([requirePermission('redirects:write')])
  .validator(
    z.object({
      rows: z
        .array(
          z.object({
            row: z.number().int(),
            id: z.string().optional(),
            fromPath: z.string(),
            toPath: z.string(),
            statusCode: z.number(),
            note: z.string().optional(),
            enabled: z.boolean(),
            keepQuery: z.boolean(),
          })
        )
        .min(1)
        .max(500),
    })
  )
  .handler(async ({ data }): Promise<BulkResult> => {
    const db = getDb();
    const existing = await db
      .select({
        id: redirects.id,
        fromPath: redirects.fromPath,
        toPath: redirects.toPath,
        statusCode: redirects.statusCode,
        keepQuery: redirects.keepQuery,
        enabled: redirects.enabled,
      })
      .from(redirects);
    const ids = new Set(existing.map((r) => r.id));
    // Which entry owns each old path, so two rows never claim the same one.
    const owner = new Map(existing.map((r) => [r.fromPath.toLowerCase(), r.id]));
    // Enabled rules as they will be after this import, to catch loops across rows.
    const rules = new Map<string, RedirectRule>(
      existing.filter((r) => r.enabled).map((r) => [r.id, r])
    );

    const result: BulkResult = { added: 0, updated: 0, skipped: [] };
    const inserts: (typeof redirects.$inferInsert)[] = [];
    for (const { row, ...input } of data.rows) {
      const parsed = redirectSchema.safeParse(input);
      if (!parsed.success) {
        result.skipped.push({ row, reason: firstIssue(parsed.error) });
        continue;
      }
      const r = parsed.data;
      const id = r.id ?? `row-${row}`;
      const key = r.fromPath.toLowerCase();
      if (r.id && !ids.has(r.id)) {
        result.skipped.push({ row, reason: 'No redirect has this id.' });
        continue;
      }
      if (owner.has(key) && owner.get(key) !== id) {
        result.skipped.push({ row, reason: `${r.fromPath} is already redirected.` });
        continue;
      }
      const toPath = r.statusCode === 410 ? '' : r.toPath;
      const rule: RedirectRule = { ...r, id, toPath };
      if (r.enabled && traceRedirect([...rules.values()], rule).loop) {
        result.skipped.push({ row, reason: 'Would send visitors round in a loop.' });
        continue;
      }

      owner.set(key, id);
      if (r.enabled) rules.set(id, rule);
      else rules.delete(id);
      const values = {
        fromPath: r.fromPath,
        toPath,
        statusCode: r.statusCode,
        enabled: r.enabled,
        keepQuery: r.keepQuery,
        note: r.note || null,
      };
      if (r.id) {
        await db
          .update(redirects)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(redirects.id, r.id));
        result.updated++;
      } else {
        inserts.push(values);
      }
    }

    for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
      await db.insert(redirects).values(inserts.slice(i, i + INSERT_CHUNK));
    }
    result.added = inserts.length;
    return result;
  });

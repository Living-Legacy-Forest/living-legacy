import { type PostInput, blogPath, postInputSchema, publishErrors, slugify } from '@llf/content';
import { type Db, schema } from '@llf/db';
import type { BatchItem } from 'drizzle-orm/batch';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';

const { posts, terms, postTerms, teamMembers, revisions, publishEvents, redirects, user } = schema;

export const POSTS_PAGE_SIZE = 20;

export const postStatusTabs = ['all', 'published', 'draft', 'trash'] as const;
export type PostStatusTab = (typeof postStatusTabs)[number];

type PostRow = typeof posts.$inferSelect;
type Statement = BatchItem<'sqlite'>;
type Statements = [Statement, ...Statement[]];

// ---------------------------------------------------------------------------
// Helpers

function conflictError() {
  return new Error(
    'Someone else saved this post while you were editing. Reload to see their changes.'
  );
}

async function loadPost(db: Db, id: string) {
  const row = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!row) throw new Error('This post no longer exists.');
  return row;
}

function assertVersion(row: PostRow, expectedUpdatedAt: number | undefined) {
  if (expectedUpdatedAt !== undefined && row.updatedAt.getTime() !== expectedUpdatedAt) {
    throw conflictError();
  }
}

async function loadTermsFor(db: Db, postIds: string[]) {
  if (postIds.length === 0) return [];
  return db
    .select({ postId: postTerms.postId, id: terms.id, name: terms.name, type: terms.type })
    .from(postTerms)
    .innerJoin(terms, eq(terms.id, postTerms.termId))
    .where(inArray(postTerms.postId, postIds))
    .orderBy(asc(terms.name));
}

/** The live (column) version of a post as editor input. */
async function liveInput(db: Db, row: PostRow): Promise<PostInput> {
  const assigned = await loadTermsFor(db, [row.id]);
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    body: (row.body as PostInput['body']) ?? null,
    authorId: row.authorId,
    categoryIds: assigned.filter((t) => t.type === 'category').map((t) => t.id),
    tags: assigned.filter((t) => t.type === 'tag').map((t) => t.name),
    seoTitle: row.seoTitle ?? '',
    seoDescription: row.seoDescription ?? '',
    noindex: row.noindex,
  };
}

/** Appends -2, -3, ... until no other non-trashed post uses the slug. */
async function uniqueSlug(db: Db, base: string, excludeId?: string) {
  const root = base || 'untitled';
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const taken = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.slug, candidate),
          isNull(posts.deletedAt),
          excludeId ? ne(posts.id, excludeId) : undefined
        )
      )
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  throw new Error('Could not find a free permalink. Try a different one.');
}

/** Term IDs for the given tag names, creating tags that do not exist yet. */
async function resolveTagIds(db: Db, names: string[]) {
  const wanted = new Map<string, string>();
  for (const name of names) {
    const slug = slugify(name);
    if (slug && !wanted.has(slug)) wanted.set(slug, name.trim());
  }
  if (wanted.size === 0) return [];
  await db
    .insert(terms)
    .values([...wanted].map(([slug, name]) => ({ type: 'tag' as const, name, slug })))
    .onConflictDoNothing();
  const rows = await db
    .select({ id: terms.id })
    .from(terms)
    .where(and(eq(terms.type, 'tag'), inArray(terms.slug, [...wanted.keys()])));
  return rows.map((r) => r.id);
}

async function validCategoryIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: terms.id })
    .from(terms)
    .where(and(eq(terms.type, 'category'), inArray(terms.id, ids)));
  return rows.map((r) => r.id);
}

/** Column values and term assignment statements for writing input to the live row. */
async function columnWrites(db: Db, id: string, input: PostInput) {
  const termIds = [
    ...(await validCategoryIds(db, input.categoryIds)),
    ...(await resolveTagIds(db, input.tags)),
  ];
  const columns = {
    title: input.title,
    excerpt: input.excerpt || null,
    body: input.body,
    authorId: input.authorId,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    noindex: input.noindex,
  };
  const termStatements: Statement[] = [
    db.delete(postTerms).where(eq(postTerms.postId, id)),
    ...(termIds.length
      ? [db.insert(postTerms).values(termIds.map((termId) => ({ postId: id, termId })))]
      : []),
  ];
  return { columns, termStatements };
}

// ---------------------------------------------------------------------------
// Reads

const listSchema = z.object({
  status: z.enum(postStatusTabs).catch('all'),
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  page: z.number().int().min(1).catch(1),
});

export const listPosts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(listSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const notTrashed = isNull(posts.deletedAt);
    const byTab = {
      all: notTrashed,
      published: and(notTrashed, eq(posts.status, 'published')),
      draft: and(notTrashed, eq(posts.status, 'draft')),
      trash: isNotNull(posts.deletedAt),
    } satisfies Record<PostStatusTab, unknown>;

    const filters = and(
      byTab[data.status],
      data.q ? like(posts.title, `%${data.q.replace(/[%_]/g, '\\$&')}%`) : undefined,
      data.category
        ? inArray(
            posts.id,
            db
              .select({ id: postTerms.postId })
              .from(postTerms)
              .where(eq(postTerms.termId, data.category))
          )
        : undefined
    );

    const [tabCounts, [{ total } = { total: 0 }], rows, categories] = await Promise.all([
      db
        .select({
          all: sql<number>`coalesce(sum(${posts.deletedAt} is null), 0)`,
          published: sql<number>`coalesce(sum(${posts.deletedAt} is null and ${posts.status} = 'published'), 0)`,
          draft: sql<number>`coalesce(sum(${posts.deletedAt} is null and ${posts.status} = 'draft'), 0)`,
          trash: sql<number>`coalesce(sum(${posts.deletedAt} is not null), 0)`,
        })
        .from(posts),
      db.select({ total: count() }).from(posts).where(filters),
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          status: posts.status,
          hasDraft: sql<boolean>`${posts.draft} is not null`,
          publishedAt: posts.publishedAt,
          updatedAt: posts.updatedAt,
          deletedAt: posts.deletedAt,
          author: teamMembers.name,
        })
        .from(posts)
        .leftJoin(teamMembers, eq(teamMembers.id, posts.authorId))
        .where(filters)
        .orderBy(
          data.status === 'trash'
            ? desc(posts.deletedAt)
            : sql`coalesce(${posts.publishedAt}, ${posts.updatedAt}) desc`
        )
        .limit(POSTS_PAGE_SIZE)
        .offset((data.page - 1) * POSTS_PAGE_SIZE),
      db
        .select({ id: terms.id, name: terms.name })
        .from(terms)
        .where(eq(terms.type, 'category'))
        .orderBy(asc(terms.name)),
    ]);

    const assigned = await loadTermsFor(
      db,
      rows.map((r) => r.id)
    );
    const counts = tabCounts[0];

    return {
      rows: rows.map((row) => ({
        ...row,
        hasDraft: Boolean(row.hasDraft),
        publishedAt: row.publishedAt?.getTime() ?? null,
        updatedAt: row.updatedAt.getTime(),
        deletedAt: row.deletedAt?.getTime() ?? null,
        categories: assigned.filter((t) => t.postId === row.id && t.type === 'category'),
        tags: assigned.filter((t) => t.postId === row.id && t.type === 'tag'),
      })),
      counts: {
        all: Number(counts?.all ?? 0),
        published: Number(counts?.published ?? 0),
        draft: Number(counts?.draft ?? 0),
        trash: Number(counts?.trash ?? 0),
      },
      total,
      pageCount: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)),
      categories,
    };
  });

export type PostListData = Awaited<ReturnType<typeof listPosts>>;
export type PostListRow = PostListData['rows'][number];

export const getPostEditorData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().optional() }))
  .handler(async ({ data }) => {
    const db = getDb();

    const [categories, tags, authors] = await Promise.all([
      db
        .select({ id: terms.id, name: terms.name })
        .from(terms)
        .where(eq(terms.type, 'category'))
        .orderBy(asc(terms.name)),
      db
        .select({ name: terms.name })
        .from(terms)
        .where(eq(terms.type, 'tag'))
        .orderBy(asc(terms.name)),
      db
        .select({ id: teamMembers.id, name: teamMembers.name })
        .from(teamMembers)
        .where(isNull(teamMembers.deletedAt))
        .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name)),
    ]);
    const options = { categories, tags: tags.map((t) => t.name), authors };

    if (!data.id) return { post: null, revisions: [], ...options };

    const row = await loadPost(db, data.id);
    const live = await liveInput(db, row);
    const values = row.draft ? ({ ...live, ...row.draft } as PostInput) : live;
    const history = await db
      .select({ id: revisions.id, createdAt: revisions.createdAt, by: user.name })
      .from(revisions)
      .leftJoin(user, eq(user.id, revisions.createdBy))
      .where(and(eq(revisions.entityType, 'post'), eq(revisions.entityId, row.id)))
      .orderBy(desc(revisions.createdAt))
      .limit(20);

    return {
      post: {
        id: row.id,
        status: row.status,
        hasDraft: row.draft !== null,
        liveSlug: row.status === 'published' ? row.slug : null,
        publishedAt: row.publishedAt?.getTime() ?? null,
        updatedAt: row.updatedAt.getTime(),
        trashed: row.deletedAt !== null,
        values,
      },
      revisions: history.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.getTime(),
        by: r.by ?? 'Someone',
      })),
      ...options,
    };
  });

export type PostEditorData = Awaited<ReturnType<typeof getPostEditorData>>;

export const getRevision = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const row = await getDb().query.revisions.findFirst({ where: eq(revisions.id, data.id) });
    if (!row) throw new Error('That revision no longer exists.');
    const parsed = postInputSchema.safeParse(row.snapshot);
    if (!parsed.success) throw new Error('That revision can no longer be loaded.');
    return parsed.data;
  });

// ---------------------------------------------------------------------------
// Writes

const writeSchema = z.object({
  id: z.string().optional(),
  values: postInputSchema,
  expectedUpdatedAt: z.number().optional(),
});

/** Creates a new draft row from input and returns it. */
async function createDraft(db: Db, input: PostInput, userId: string) {
  const slug = await uniqueSlug(db, input.slug || slugify(input.title));
  const [row] = await db
    .insert(posts)
    .values({
      title: input.title || 'Untitled',
      slug,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();
  if (!row) throw new Error('Could not create the post.');
  const { columns, termStatements } = await columnWrites(db, row.id, input);
  const [updated] = await db.batch([
    db.update(posts).set(columns).where(eq(posts.id, row.id)).returning(),
    ...termStatements,
  ]);
  return updated[0] ?? row;
}

export const savePost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(writeSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const userId = context.user.id;

    if (!data.id) {
      const row = await createDraft(db, data.values, userId);
      return { id: row.id, updatedAt: row.updatedAt.getTime(), slug: row.slug };
    }

    const row = await loadPost(db, data.id);
    if (row.deletedAt) throw new Error('Restore this post from the trash before editing it.');
    assertVersion(row, data.expectedUpdatedAt);
    const now = new Date();

    // Published: park the edits in `draft` so the live version is untouched.
    if (row.status === 'published') {
      await db
        .update(posts)
        .set({ draft: data.values, updatedAt: now, updatedBy: userId })
        .where(eq(posts.id, row.id));
      return { id: row.id, updatedAt: now.getTime(), slug: data.values.slug };
    }

    const slug = await uniqueSlug(db, data.values.slug || slugify(data.values.title), row.id);
    const { columns, termStatements } = await columnWrites(db, row.id, data.values);
    await db.batch([
      db
        .update(posts)
        .set({ ...columns, slug, draft: null, updatedAt: now, updatedBy: userId })
        .where(eq(posts.id, row.id)),
      ...termStatements,
    ]);
    return { id: row.id, updatedAt: now.getTime(), slug };
  });

export const publishPost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(writeSchema)
  .handler(async ({ data, context }) => {
    const errors = publishErrors(data.values);
    if (errors.length) throw new Error(errors.join(' '));

    const db = getDb();
    const userId = context.user.id;
    const row = data.id ? await loadPost(db, data.id) : await createDraft(db, data.values, userId);
    if (row.deletedAt) throw new Error('Restore this post from the trash before publishing it.');
    if (data.id) assertVersion(row, data.expectedUpdatedAt);

    const slug = await uniqueSlug(db, data.values.slug, row.id);
    const values = { ...data.values, slug };
    const now = new Date();
    const publishedAt = row.publishedAt ?? now;
    const wasLive = row.status === 'published';
    const oldPath = blogPath(row.slug);
    const newPath = blogPath(slug);

    const { columns, termStatements } = await columnWrites(db, row.id, values);
    const statements: Statement[] = [
      db
        .update(posts)
        .set({
          ...columns,
          slug,
          status: 'published' as const,
          publishedAt,
          draft: null,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(posts.id, row.id)),
      ...termStatements,
      db.insert(revisions).values({
        entityType: 'post',
        entityId: row.id,
        snapshot: values,
        createdBy: userId,
      }),
      db.insert(publishEvents).values({
        entityType: 'post',
        entityId: row.id,
        action: 'publish',
        paths: wasLive && oldPath !== newPath ? [oldPath, newPath, '/blog'] : [newPath, '/blog'],
      }),
      // The new URL must never redirect away (for example after renaming back).
      db.delete(redirects).where(eq(redirects.fromPath, newPath)),
    ];
    // Keep old links working when a live post's permalink changes.
    if (wasLive && oldPath !== newPath) {
      statements.push(
        db
          .insert(redirects)
          .values({
            fromPath: oldPath,
            toPath: newPath,
            statusCode: 301,
            note: 'Permalink changed',
          })
          .onConflictDoUpdate({
            target: redirects.fromPath,
            set: { toPath: newPath, updatedAt: now },
          }),
        // Earlier redirects to the old URL now point straight at the new one.
        db
          .update(redirects)
          .set({ toPath: newPath, updatedAt: now })
          .where(eq(redirects.toPath, oldPath))
      );
    }
    await db.batch(statements as Statements);
    return { id: row.id, updatedAt: now.getTime(), slug };
  });

const idSchema = z.object({ id: z.string() });
const idsSchema = z.object({ ids: z.array(z.string()).min(1).max(100) });

export const discardChanges = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(idSchema)
  .handler(async ({ data, context }) => {
    const now = new Date();
    await getDb()
      .update(posts)
      .set({ draft: null, updatedAt: now, updatedBy: context.user.id })
      .where(eq(posts.id, data.id));
  });

export const unpublishPost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(idSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const row = await loadPost(db, data.id);
    if (row.status !== 'published') return;
    const now = new Date();
    // Pending edits become the working copy now that nothing is live.
    const pending = row.draft ? postInputSchema.safeParse(row.draft) : null;
    const writes = pending?.success ? await columnWrites(db, row.id, pending.data) : null;
    const statements: Statement[] = [
      db
        .update(posts)
        .set({
          ...(writes?.columns ?? {}),
          status: 'draft' as const,
          draft: null,
          updatedAt: now,
          updatedBy: context.user.id,
        })
        .where(eq(posts.id, row.id)),
      ...(writes?.termStatements ?? []),
      db.insert(publishEvents).values({
        entityType: 'post',
        entityId: row.id,
        action: 'unpublish',
        paths: [blogPath(row.slug), '/blog'],
      }),
    ];
    await db.batch(statements as Statements);
  });

export const trashPosts = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(idsSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const rows = await db
      .select({ id: posts.id, slug: posts.slug, status: posts.status })
      .from(posts)
      .where(and(inArray(posts.id, data.ids), isNull(posts.deletedAt)));
    if (rows.length === 0) return { count: 0 };
    const now = new Date();
    const live = rows.filter((r) => r.status === 'published');
    const statements: Statement[] = [
      db
        .update(posts)
        .set({ deletedAt: now, status: 'draft', updatedAt: now, updatedBy: context.user.id })
        .where(
          inArray(
            posts.id,
            rows.map((r) => r.id)
          )
        ),
      ...live.map((r) =>
        db.insert(publishEvents).values({
          entityType: 'post',
          entityId: r.id,
          action: 'trash',
          paths: [blogPath(r.slug), '/blog'],
        })
      ),
    ];
    await db.batch(statements as Statements);
    return { count: rows.length };
  });

export const restorePosts = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(idsSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const rows = await db
      .select({ id: posts.id, slug: posts.slug })
      .from(posts)
      .where(and(inArray(posts.id, data.ids), isNotNull(posts.deletedAt)));
    const now = new Date();
    // One at a time: a live post may have taken the slug while this was in the trash.
    for (const row of rows) {
      const slug = await uniqueSlug(db, row.slug, row.id);
      await db
        .update(posts)
        .set({ slug, deletedAt: null, updatedAt: now, updatedBy: context.user.id })
        .where(eq(posts.id, row.id));
    }
    return { count: rows.length };
  });

export const deletePosts = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:purge')])
  .validator(idsSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(inArray(posts.id, data.ids), isNotNull(posts.deletedAt)));
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return { count: 0 };
    await db.batch([
      db
        .delete(revisions)
        .where(and(eq(revisions.entityType, 'post'), inArray(revisions.entityId, ids))),
      db.delete(posts).where(inArray(posts.id, ids)),
    ]);
    return { count: ids.length };
  });

export const createCategory = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ name: z.string().trim().min(1).max(60) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const slug = slugify(data.name);
    if (!slug) throw new Error('Use letters or numbers in the category name.');
    const existing = await db.query.terms.findFirst({
      where: and(eq(terms.type, 'category'), eq(terms.slug, slug)),
    });
    if (existing) return { id: existing.id, name: existing.name };
    const [row] = await db
      .insert(terms)
      .values({ type: 'category', name: data.name, slug })
      .returning({ id: terms.id, name: terms.name });
    if (!row) throw new Error('Could not create the category.');
    return row;
  });

/** What the post will look like: pending changes if any, else the live version. */
export const getPostPreview = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const row = await loadPost(db, data.id);
    const live = await liveInput(db, row);
    const values = row.draft ? ({ ...live, ...row.draft } as PostInput) : live;
    const [author, categories] = await Promise.all([
      values.authorId
        ? db.query.teamMembers.findFirst({ where: eq(teamMembers.id, values.authorId) })
        : undefined,
      values.categoryIds.length
        ? db
            .select({ name: terms.name })
            .from(terms)
            .where(inArray(terms.id, values.categoryIds))
            .orderBy(asc(terms.name))
        : [],
    ]);
    return {
      id: row.id,
      title: values.title,
      excerpt: values.excerpt,
      body: values.body,
      slug: values.slug,
      tags: values.tags,
      categories: categories.map((c) => c.name),
      author: author?.name ?? null,
      status: row.status,
      hasDraft: row.draft !== null,
      publishedAt: row.publishedAt?.getTime() ?? null,
    };
  });

import { type PostInput, blogPath, publishErrors, slugify } from '@ll/content';
import type { Db } from '@ll/db';
import { postTerms, posts, publishEvents, redirects, revisions, terms, user } from '@ll/db/schema';
import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { logActivity } from './activity-log';

// Database operations for posts, shared by the server functions and the
// scheduler (which runs outside any request, so nothing here reads one).

export type PostRow = typeof posts.$inferSelect;
export type Statement = BatchItem<'sqlite'>;
export type Statements = [Statement, ...Statement[]];

// ---------------------------------------------------------------------------
// Helpers

function conflictError() {
  return new Error(
    'Someone else saved this post while you were editing. Reload to see their changes.'
  );
}

export async function loadPost(db: Db, id: string) {
  const row = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!row) throw new Error('This post no longer exists.');
  return row;
}

export function assertVersion(row: PostRow, expectedUpdatedAt: number | undefined) {
  if (expectedUpdatedAt !== undefined && row.updatedAt.getTime() !== expectedUpdatedAt) {
    throw conflictError();
  }
}

export async function loadTermsFor(db: Db, postIds: string[]) {
  if (postIds.length === 0) return [];
  return db
    .select({ postId: postTerms.postId, id: terms.id, name: terms.name, type: terms.type })
    .from(postTerms)
    .innerJoin(terms, eq(terms.id, postTerms.termId))
    .where(inArray(postTerms.postId, postIds))
    .orderBy(asc(terms.name));
}

/** The live (column) version of a post as editor input. */
export async function liveInput(db: Db, row: PostRow): Promise<PostInput> {
  const assigned = await loadTermsFor(db, [row.id]);
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    body: (row.body as PostInput['body']) ?? null,
    authorId: row.authorId,
    categoryIds: assigned.filter((t) => t.type === 'category').map((t) => t.id),
    tags: assigned.filter((t) => t.type === 'tag').map((t) => t.name),
    featuredMediaId: row.featuredMediaId,
    seoTitle: row.seoTitle ?? '',
    seoDescription: row.seoDescription ?? '',
    ogMediaId: row.ogMediaId,
    noindex: row.noindex,
  };
}

/** Appends -2, -3, ... until no other non-trashed post uses the slug. */
export async function uniqueSlug(db: Db, base: string, excludeId?: string) {
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
export async function columnWrites(db: Db, id: string, input: PostInput) {
  const termIds = [
    ...(await validCategoryIds(db, input.categoryIds)),
    ...(await resolveTagIds(db, input.tags)),
  ];
  const columns = {
    title: input.title,
    excerpt: input.excerpt || null,
    body: input.body,
    authorId: input.authorId,
    featuredMediaId: input.featuredMediaId,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    ogMediaId: input.ogMediaId,
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

/**
 * Saves editor input to an existing post, as the editor's Save button and the
 * API's PATCH both do. A published post keeps its live version and parks the
 * edits in `draft`; anything else is written to its columns directly.
 */
export async function saveEdits(db: Db, row: PostRow, values: PostInput, userId: string) {
  if (row.deletedAt) throw new Error('Restore this post from the trash before editing it.');
  const now = new Date();

  // Published: park the edits in `draft` so the live version is untouched.
  if (row.status === 'published') {
    await db
      .update(posts)
      .set({ draft: values, updatedAt: now, updatedBy: userId })
      .where(eq(posts.id, row.id));
    return { id: row.id, updatedAt: now.getTime(), slug: values.slug };
  }

  // A scheduled post must stay publishable, or the scheduler would fail.
  if (row.scheduledAt && publishErrors(values).length) {
    throw new Error(`${publishErrors(values).join(' ')} This post is scheduled, so it needs both.`);
  }
  const slug = await uniqueSlug(db, values.slug || slugify(values.title), row.id);
  const { columns, termStatements } = await columnWrites(db, row.id, values);
  await db.batch([
    db
      .update(posts)
      .set({ ...columns, slug, draft: null, updatedAt: now, updatedBy: userId })
      .where(eq(posts.id, row.id)),
    ...termStatements,
  ]);
  return { id: row.id, updatedAt: now.getTime(), slug };
}

/** Creates a new draft row from input and returns it. */
export async function createDraft(db: Db, input: PostInput, userId: string) {
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

/**
 * Makes `input` the live version of `row`: columns, terms, a revision, a
 * publish event, and a 301 when a live post's permalink changes. Used by the
 * Publish button and by the scheduler.
 */
export async function publishValues(
  db: Db,
  row: PostRow,
  input: PostInput,
  actorId: string | null,
  /** Already known to the caller (e.g. the session), to skip a lookup. */
  actorName?: string
) {
  const slug = await uniqueSlug(db, input.slug, row.id);
  const values = { ...input, slug };
  const now = new Date();
  const publishedAt = row.publishedAt ?? now;
  const wasLive = row.status === 'published';
  const oldPath = blogPath(row.slug);
  const newPath = blogPath(slug);

  const resolvedActorName =
    actorName ??
    (actorId
      ? ((await db.query.user.findFirst({ where: eq(user.id, actorId) }))?.name ?? 'Someone')
      : 'Someone');

  const { columns, termStatements } = await columnWrites(db, row.id, values);
  const statements: Statement[] = [
    db
      .update(posts)
      .set({
        ...columns,
        slug,
        status: 'published' as const,
        scheduledAt: null,
        reviewRequestedAt: null,
        publishedAt,
        draft: null,
        updatedAt: now,
        updatedBy: actorId,
      })
      .where(eq(posts.id, row.id)),
    ...termStatements,
    db.insert(revisions).values({
      entityType: 'post',
      entityId: row.id,
      snapshot: values,
      createdBy: actorId,
    }),
    db.insert(publishEvents).values({
      entityType: 'post',
      entityId: row.id,
      action: 'publish',
      paths: wasLive && oldPath !== newPath ? [oldPath, newPath, '/blog'] : [newPath, '/blog'],
    }),
    // The new URL must never redirect away (for example after renaming back).
    db.delete(redirects).where(eq(redirects.fromPath, newPath)),
    logActivity(db, {
      actorId,
      actorName: resolvedActorName,
      action: 'post.published',
      summary: `Published "${values.title || 'Untitled'}"`,
    }),
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
}

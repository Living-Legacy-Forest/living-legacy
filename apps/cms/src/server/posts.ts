import {
  type PostInput,
  blogPath,
  can,
  contentTargetsFrom,
  postInputSchema,
  publishErrors,
  roles,
  slugify,
} from '@ll/content';
import {
  posts,
  postTerms,
  publishEvents,
  revisions,
  locations,
  teamMembers,
  terms,
  user,
} from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { cmsOrigin, sendReviewRequestedEmail } from '@/lib/email';
import { type SessionUser, authMiddleware, requirePermission } from '@/lib/session';
import { readSiteSettings } from '@/lib/site-settings';
import { logActivity } from './activity-log';
import { loadContentTargets, scoreInputFromColumns, scorePost } from './post-score';
import {
  type PostRow,
  type Statement,
  type Statements,
  assertVersion,
  columnWrites,
  createDraft,
  liveInput,
  loadPost,
  loadTermsFor,
  publishValues,
  saveEdits,
  uniqueSlug,
} from './post-store';

/** Authors may only change posts they started; publishers may change any. */
function assertCanEdit(row: PostRow, actor: SessionUser) {
  if (!can(actor.role, 'posts:publish') && row.createdBy !== actor.id) {
    throw new Error('You can only edit posts you wrote.');
  }
}

/** Roles that may publish, i.e. who is eligible to review a post. */
const publishRoles = () => roles.filter((r) => can(r, 'posts:publish'));

export const POSTS_PAGE_SIZE = 20;

export const postStatusTabs = [
  'all',
  'published',
  'scheduled',
  'draft',
  'review',
  'trash',
] as const;
export type PostStatusTab = (typeof postStatusTabs)[number];

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
      scheduled: and(notTrashed, eq(posts.status, 'draft'), isNotNull(posts.scheduledAt)),
      draft: and(notTrashed, eq(posts.status, 'draft'), isNull(posts.scheduledAt)),
      review: and(notTrashed, isNotNull(posts.reviewRequestedAt)),
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

    const [tabCounts, [{ total } = { total: 0 }], rows, categories, reviewers] = await db.batch([
      db
        .select({
          all: sql<number>`coalesce(sum(${posts.deletedAt} is null), 0)`,
          published: sql<number>`coalesce(sum(${posts.deletedAt} is null and ${posts.status} = 'published'), 0)`,
          scheduled: sql<number>`coalesce(sum(${posts.deletedAt} is null and ${posts.status} = 'draft' and ${posts.scheduledAt} is not null), 0)`,
          draft: sql<number>`coalesce(sum(${posts.deletedAt} is null and ${posts.status} = 'draft' and ${posts.scheduledAt} is null), 0)`,
          review: sql<number>`coalesce(sum(${posts.deletedAt} is null and ${posts.reviewRequestedAt} is not null), 0)`,
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
          scheduledAt: posts.scheduledAt,
          reviewRequestedAt: posts.reviewRequestedAt,
          reviewerId: posts.reviewerId,
          createdBy: posts.createdBy,
          author: teamMembers.name,
          // The same gaps Content checks lists, so the list can flag them too.
          noDescription: sql<boolean>`coalesce(trim(${posts.seoDescription}), '') = '' and coalesce(trim(${posts.excerpt}), '') = ''`,
          noShareImage: sql<boolean>`${posts.ogMediaId} is null and ${posts.featuredMediaId} is null`,
        })
        .from(posts)
        .leftJoin(teamMembers, eq(teamMembers.id, posts.authorId))
        .where(filters)
        .orderBy(
          data.status === 'trash'
            ? desc(posts.deletedAt)
            : data.status === 'scheduled'
              ? asc(posts.scheduledAt)
              : sql`coalesce(${posts.publishedAt}, ${posts.updatedAt}) desc`
        )
        .limit(POSTS_PAGE_SIZE)
        .offset((data.page - 1) * POSTS_PAGE_SIZE),
      db
        .select({ id: terms.id, name: terms.name })
        .from(terms)
        .where(eq(terms.type, 'category'))
        .orderBy(asc(terms.name)),
      db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.role, publishRoles()))
        .orderBy(asc(user.name)),
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
        noDescription: Boolean(row.noDescription),
        noShareImage: Boolean(row.noShareImage),
        publishedAt: row.publishedAt?.getTime() ?? null,
        updatedAt: row.updatedAt.getTime(),
        deletedAt: row.deletedAt?.getTime() ?? null,
        scheduledAt: row.scheduledAt?.getTime() ?? null,
        reviewRequestedAt: row.reviewRequestedAt?.getTime() ?? null,
        categories: assigned.filter((t) => t.postId === row.id && t.type === 'category'),
        tags: assigned.filter((t) => t.postId === row.id && t.type === 'tag'),
      })),
      counts: {
        all: Number(counts?.all ?? 0),
        published: Number(counts?.published ?? 0),
        scheduled: Number(counts?.scheduled ?? 0),
        draft: Number(counts?.draft ?? 0),
        review: Number(counts?.review ?? 0),
        trash: Number(counts?.trash ?? 0),
      },
      total,
      pageCount: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)),
      categories,
      reviewers,
    };
  });

export type PostListData = Awaited<ReturnType<typeof listPosts>>;
export type PostListRow = PostListData['rows'][number];

export const getPostEditorData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().optional() }))
  .handler(async ({ data }) => {
    const db = getDb();

    const [categories, tags, authors, reviewers, locationOptions] = await db.batch([
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
      db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.role, publishRoles()))
        .orderBy(asc(user.name)),
      db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(isNull(locations.deletedAt))
        .orderBy(asc(locations.name)),
    ]);
    const options = {
      categories,
      tags: tags.map((t) => t.name),
      authors,
      reviewers,
      locations: locationOptions,
      contentTargets: contentTargetsFrom(await readSiteSettings()),
    };

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
        scheduledAt: row.scheduledAt?.getTime() ?? null,
        reviewRequestedAt: row.reviewRequestedAt?.getTime() ?? null,
        createdBy: row.createdBy,
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

export const savePost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:write')])
  .validator(writeSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const userId = context.user.id;

    if (!data.id) {
      const row = await createDraft(db, data.values, userId);
      return { id: row.id, updatedAt: row.updatedAt.getTime(), slug: row.slug };
    }

    const row = await loadPost(db, data.id);
    assertCanEdit(row, context.user);
    // A scheduled post's content is what the publisher approved, and the cron
    // job publishes it as is. Letting an author change it would put unreviewed
    // content live.
    if (row.scheduledAt && !can(context.user.role, 'posts:publish')) {
      throw new Error(
        'This post is scheduled. Ask an editor to unschedule it before you change it.'
      );
    }
    assertVersion(row, data.expectedUpdatedAt);
    return saveEdits(db, row, data.values, userId);
  });

export const publishPost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:publish')])
  .validator(writeSchema)
  .handler(async ({ data, context }) => {
    const errors = publishErrors(data.values);
    if (errors.length) throw new Error(errors.join(' '));

    const db = getDb();
    const userId = context.user.id;
    const row = data.id ? await loadPost(db, data.id) : await createDraft(db, data.values, userId);
    if (row.deletedAt) throw new Error('Restore this post from the trash before publishing it.');
    if (data.id) assertVersion(row, data.expectedUpdatedAt);

    return publishValues(db, row, data.values, userId, context.user.name);
  });

const idSchema = z.object({ id: z.string() });

/** Earliest a post can be scheduled for: the scheduler runs every five minutes. */
const MIN_SCHEDULE_LEAD_MS = 60_000;

export const schedulePost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:publish')])
  .validator(writeSchema.extend({ scheduledAt: z.number().int() }))
  .handler(async ({ data, context }) => {
    const errors = publishErrors(data.values);
    if (errors.length) throw new Error(errors.join(' '));
    if (data.scheduledAt < Date.now() + MIN_SCHEDULE_LEAD_MS) {
      throw new Error('Pick a time at least a minute from now, or publish now instead.');
    }

    const db = getDb();
    const userId = context.user.id;
    const row = data.id ? await loadPost(db, data.id) : await createDraft(db, data.values, userId);
    if (row.deletedAt) throw new Error('Restore this post from the trash before scheduling it.');
    if (row.status === 'published') throw new Error('This post is already live.');
    if (data.id) assertVersion(row, data.expectedUpdatedAt);

    const now = new Date();
    const slug = await uniqueSlug(db, data.values.slug, row.id);
    const { columns, termStatements } = await columnWrites(db, row.id, data.values);
    await db.batch([
      db
        .update(posts)
        .set({
          ...columns,
          slug,
          draft: null,
          scheduledAt: new Date(data.scheduledAt),
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(posts.id, row.id)),
      ...termStatements,
      logActivity(db, {
        actorId: userId,
        actorName: context.user.name,
        action: 'post.scheduled',
        summary: `Scheduled "${data.values.title || 'Untitled'}"`,
      }),
    ]);
    return { id: row.id, updatedAt: now.getTime(), slug, scheduledAt: data.scheduledAt };
  });

export const unschedulePost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:publish')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const now = new Date();
    await getDb()
      .update(posts)
      .set({ scheduledAt: null, updatedAt: now, updatedBy: context.user.id })
      .where(eq(posts.id, data.id));
    return { updatedAt: now.getTime() };
  });
const idsSchema = z.object({ ids: z.array(z.string()).min(1).max(100) });

export const discardChanges = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:write')])
  .validator(idSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    assertCanEdit(await loadPost(db, data.id), context.user);
    const now = new Date();
    await db
      .update(posts)
      .set({ draft: null, updatedAt: now, updatedBy: context.user.id })
      .where(eq(posts.id, data.id));
  });

/** An author hands a saved post to an editor. Publishing clears the request. */
export const requestReview = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:write')])
  .validator(idSchema.extend({ reviewerId: z.string().nullable().optional() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const row = await loadPost(db, data.id);
    assertCanEdit(row, context.user);
    if (row.deletedAt) throw new Error('Restore this post from the trash first.');

    // A chosen reviewer must actually be someone who can publish.
    let reviewerId: string | null = null;
    if (data.reviewerId) {
      const reviewer = await db.query.user.findFirst({ where: eq(user.id, data.reviewerId) });
      if (!reviewer || !can(reviewer.role, 'posts:publish')) {
        throw new Error('Choose someone who can publish posts.');
      }
      reviewerId = reviewer.id;
    }

    const now = new Date();
    await db
      .update(posts)
      .set({ reviewRequestedAt: now, reviewerId, updatedAt: now, updatedBy: context.user.id })
      .where(eq(posts.id, row.id));

    // Best-effort: a failed email must not lose the review request. A chosen
    // reviewer gets it alone; otherwise everyone who can publish does.
    const recipients = await db
      .select({ email: user.email })
      .from(user)
      .where(
        reviewerId
          ? eq(user.id, reviewerId)
          : and(inArray(user.role, publishRoles()), ne(user.id, context.user.id))
      );
    const postUrl = `${cmsOrigin()}/posts/${row.id}`;
    await Promise.allSettled(
      recipients.map((r) =>
        sendReviewRequestedEmail(r.email, {
          postTitle: row.title,
          authorName: context.user.name,
          postUrl,
        })
      )
    );

    return { reviewRequestedAt: now.getTime(), updatedAt: now.getTime() };
  });

/** Copies a post's current content (its draft, if it has one) into a new draft. */
export const duplicatePost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:write')])
  .validator(idSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const row = await loadPost(db, data.id);
    if (row.deletedAt) throw new Error('Restore this post from the trash before duplicating it.');
    const live = await liveInput(db, row);
    const values = row.draft ? ({ ...live, ...row.draft } as PostInput) : live;
    const title = `${values.title} (copy)`;
    const created = await createDraft(
      db,
      { ...values, title, slug: slugify(title) },
      context.user.id
    );
    return { id: created.id };
  });

const seoSchema = postInputSchema
  .pick({
    seoTitle: true,
    seoDescription: true,
    noindex: true,
    ogMediaId: true,
    focusKeyword: true,
    relatedTerms: true,
  })
  .extend({ id: z.string(), expectedUpdatedAt: z.number().optional() });

/**
 * SEO fields only, for people who may not change a post's content. They apply
 * straight away, to the live post and to any pending edits, so a later
 * publish keeps them.
 */
export const savePostSeo = createServerFn({ method: 'POST' })
  .middleware([requirePermission('seo:write')])
  .validator(seoSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const row = await loadPost(db, data.id);
    if (row.deletedAt) throw new Error('Restore this post from the trash first.');
    assertVersion(row, data.expectedUpdatedAt);
    const seo = {
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      noindex: data.noindex,
      ogMediaId: data.ogMediaId,
      focusKeyword: data.focusKeyword || null,
      relatedTerms: data.relatedTerms,
    };
    // The columns change, so their score does too.
    const contentScore = scorePost(
      scoreInputFromColumns({ ...row, ...seo }),
      await loadContentTargets(db)
    );
    const now = new Date();
    const statements: Statement[] = [
      db
        .update(posts)
        .set({
          ...seo,
          contentScore,
          draft: row.draft
            ? {
                ...row.draft,
                seoTitle: data.seoTitle,
                seoDescription: data.seoDescription,
                noindex: data.noindex,
                ogMediaId: data.ogMediaId,
                focusKeyword: data.focusKeyword,
                relatedTerms: data.relatedTerms,
              }
            : null,
          updatedAt: now,
          updatedBy: context.user.id,
        })
        .where(eq(posts.id, row.id)),
    ];
    if (row.status === 'published') {
      statements.push(
        db.insert(publishEvents).values({
          entityType: 'post',
          entityId: row.id,
          action: 'update',
          paths: [blogPath(row.slug)],
        })
      );
    }
    await db.batch(statements as Statements);
    return { updatedAt: now.getTime() };
  });

export const unpublishPost = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:publish')])
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
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'post.unpublished',
        summary: `Unpublished "${row.title || 'Untitled'}"`,
      }),
    ];
    await db.batch(statements as Statements);
  });

export const trashPosts = createServerFn({ method: 'POST' })
  .middleware([requirePermission('posts:publish')])
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
        .set({
          deletedAt: now,
          status: 'draft',
          scheduledAt: null,
          updatedAt: now,
          updatedBy: context.user.id,
        })
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
  .middleware([requirePermission('posts:publish')])
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
  .middleware([requirePermission('posts:write')])
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
      scheduledAt: row.scheduledAt?.getTime() ?? null,
    };
  });

export type PostPreviewData = Awaited<ReturnType<typeof getPostPreview>>;

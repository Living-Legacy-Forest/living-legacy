// Database work for the legal pages, shared by the server functions and the
// integration tests. The typed columns are the live version; edits wait in
// `draft` until an admin publishes them.
import {
  type LegalSlug,
  type LegalValues,
  legalPath,
  legalPublishErrors,
  legalValuesSchema,
} from '@ll/content';
import type { Db } from '@ll/db';
import { activityLog, legalPages, publishEvents, revisions, user } from '@ll/db/schema';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { logActivity } from './activity-log';

export type LegalPageRow = typeof legalPages.$inferSelect;
export type Actor = { id: string; name: string };
export type LegalPageSummary = {
  slug: LegalSlug;
  title: string;
  hasDraft: boolean;
  reviewRequestedAt: number | null;
  lastPublishedAt: number | null;
};

function conflictError() {
  return new Error(
    'Someone else saved this page while you were editing. Reload to see their changes.'
  );
}

export function currentValues(row: LegalPageRow): LegalValues {
  const draft = row.draft as LegalValues | null;
  return (
    draft ?? {
      title: row.title,
      body: row.body as LegalValues['body'],
      seoDescription: row.seoDescription ?? '',
    }
  );
}

export async function loadLegalPage(db: Db, slug: LegalSlug) {
  const row = await db.query.legalPages.findFirst({ where: eq(legalPages.slug, slug) });
  if (!row) throw new Error('This page does not exist.');
  return row;
}

function assertVersion(row: LegalPageRow, expectedUpdatedAt: number) {
  if (row.updatedAt.getTime() !== expectedUpdatedAt) throw conflictError();
}

// Writes only land on the version the editor loaded. The check above fails
// fast; this one makes it atomic, so two people saving at the same moment
// cannot both pass and have one silently overwrite the other.
const atVersion = (id: string, expectedUpdatedAt: number) =>
  and(eq(legalPages.id, id), eq(legalPages.updatedAt, new Date(expectedUpdatedAt)));

export async function listLegalPageSummaries(db: Db): Promise<LegalPageSummary[]> {
  const rows = await db.select().from(legalPages).orderBy(legalPages.slug);
  return rows.map((r) => ({
    slug: r.slug as LegalSlug,
    title: currentValues(r).title,
    hasDraft: r.draft !== null,
    reviewRequestedAt: r.reviewRequestedAt?.getTime() ?? null,
    lastPublishedAt: r.lastPublishedAt?.getTime() ?? null,
  }));
}

/**
 * Saves pending edits. Someone who cannot publish changing a page that is
 * waiting for review withdraws the request (`keepReview` false), so an admin
 * never approves a page that is still changing; they ask again when it is
 * ready. An admin editing during the review keeps it.
 */
export async function saveLegalDraft(
  db: Db,
  slug: LegalSlug,
  values: LegalValues,
  expectedUpdatedAt: number,
  actor: Actor,
  keepReview: boolean
) {
  const row = await loadLegalPage(db, slug);
  assertVersion(row, expectedUpdatedAt);
  const now = new Date();
  const reviewWithdrawn = row.reviewRequestedAt !== null && !keepReview;
  const written = await db
    .update(legalPages)
    .set({
      draft: values,
      ...(reviewWithdrawn ? { reviewRequestedAt: null } : {}),
      updatedAt: now,
      updatedBy: actor.id,
    })
    .where(atVersion(row.id, expectedUpdatedAt))
    .returning({ id: legalPages.id });
  if (!written.length) throw conflictError();
  return { updatedAt: now.getTime(), reviewWithdrawn };
}

export async function requestLegalReview(db: Db, slug: LegalSlug, actor: Actor) {
  const row = await loadLegalPage(db, slug);
  if (!row.draft) throw new Error('Save your changes before asking for a review.');
  const now = new Date();
  await db.batch([
    db
      .update(legalPages)
      .set({ reviewRequestedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(eq(legalPages.id, row.id)),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'legal_page.review_requested',
      summary: `Asked for a review of ${currentValues(row).title}`,
    }),
  ]);
  return { updatedAt: now.getTime(), reviewRequestedAt: now.getTime() };
}

export async function publishLegalDraft(
  db: Db,
  slug: LegalSlug,
  expectedUpdatedAt: number,
  actor: Actor
) {
  const row = await loadLegalPage(db, slug);
  assertVersion(row, expectedUpdatedAt);
  if (!row.draft) throw new Error('There are no changes to publish.');
  const values = currentValues(row);
  const errors = legalPublishErrors(values);
  if (errors.length) throw new Error(errors.join(' '));

  const now = new Date();
  // The history, publish and activity rows are each inserted from a select of
  // this page at the version the update just set, so they only appear if the
  // update landed. One batch, so one transaction.
  const landed = and(eq(legalPages.id, row.id), eq(legalPages.updatedAt, now));
  const value = <T>(v: T, column: string) => sql<T>`${v}`.as(column);
  const [written] = await db.batch([
    db
      .update(legalPages)
      .set({
        title: values.title,
        body: values.body,
        seoDescription: values.seoDescription || null,
        draft: null,
        status: 'published',
        reviewRequestedAt: null,
        lastPublishedAt: now,
        publishedAt: row.publishedAt ?? now,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(atVersion(row.id, expectedUpdatedAt))
      .returning({ id: legalPages.id }),
    db.insert(revisions).select(
      db
        .select({
          id: value(crypto.randomUUID(), 'id'),
          entityType: value('legal_page' as const, 'entity_type'),
          entityId: legalPages.id,
          snapshot: value(JSON.stringify(values), 'snapshot'),
          createdBy: value(actor.id, 'created_by'),
          createdAt: value(now.getTime(), 'created_at'),
        })
        .from(legalPages)
        .where(landed)
    ),
    db.insert(publishEvents).select(
      db
        .select({
          id: value(crypto.randomUUID(), 'id'),
          entityType: value('legal_page' as const, 'entity_type'),
          entityId: legalPages.id,
          action: value('publish' as const, 'action'),
          paths: value(JSON.stringify([legalPath(slug)]), 'paths'),
          createdAt: value(now.getTime(), 'created_at'),
        })
        .from(legalPages)
        .where(landed)
    ),
    db.insert(activityLog).select(
      db
        .select({
          id: value(crypto.randomUUID(), 'id'),
          actorId: value(actor.id, 'actor_id'),
          actorName: value(actor.name, 'actor_name'),
          action: value('legal_page.published' as const, 'action'),
          summary: value(`Published ${values.title}`, 'summary'),
          createdAt: value(now.getTime(), 'created_at'),
        })
        .from(legalPages)
        .where(landed)
    ),
  ]);
  if (!written.length) throw conflictError();
  return { updatedAt: now.getTime(), lastPublishedAt: now.getTime() };
}

export async function discardLegalDraft(
  db: Db,
  slug: LegalSlug,
  expectedUpdatedAt: number,
  actor: Actor
) {
  const row = await loadLegalPage(db, slug);
  assertVersion(row, expectedUpdatedAt);
  const now = new Date();
  const written = await db
    .update(legalPages)
    .set({ draft: null, reviewRequestedAt: null, updatedAt: now, updatedBy: actor.id })
    .where(atVersion(row.id, expectedUpdatedAt))
    .returning({ id: legalPages.id });
  if (!written.length) throw conflictError();
  return { updatedAt: now.getTime() };
}

export async function listLegalHistory(db: Db, pageId: string) {
  const rows = await db
    .select({ id: revisions.id, createdAt: revisions.createdAt, by: user.name })
    .from(revisions)
    .leftJoin(user, eq(user.id, revisions.createdBy))
    .where(and(eq(revisions.entityType, 'legal_page'), eq(revisions.entityId, pageId)))
    .orderBy(desc(revisions.createdAt));
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.getTime(), by: r.by }));
}

export async function loadLegalRevision(db: Db, revisionId: string) {
  const row = await db.query.revisions.findFirst({
    where: and(eq(revisions.id, revisionId), eq(revisions.entityType, 'legal_page')),
  });
  if (!row) throw new Error('That version could not be found.');
  return { ...(row.snapshot as LegalValues), createdAt: row.createdAt.getTime() };
}

/** Copies a published version of this page into its draft, to check and publish again. */
export async function restoreLegalRevision(
  db: Db,
  slug: LegalSlug,
  revisionId: string,
  expectedUpdatedAt: number,
  actor: Actor,
  /** As for saveLegalDraft: whether a pending review request survives. */
  keepReview: boolean
) {
  const row = await loadLegalPage(db, slug);
  const revision = await db.query.revisions.findFirst({
    where: and(
      eq(revisions.id, revisionId),
      eq(revisions.entityType, 'legal_page'),
      eq(revisions.entityId, row.id)
    ),
  });
  if (!revision) throw new Error('That version could not be found.');
  // Old snapshots predate any later rule changes, so check them as a save would.
  const parsed = legalValuesSchema.safeParse(revision.snapshot);
  if (!parsed.success) throw new Error('That version can no longer be restored.');
  return saveLegalDraft(db, slug, parsed.data, expectedUpdatedAt, actor, keepReview);
}

export async function listLegalReviewRequests(db: Db) {
  const rows = await db
    .select()
    .from(legalPages)
    .where(isNotNull(legalPages.reviewRequestedAt))
    .orderBy(desc(legalPages.reviewRequestedAt));
  return rows.map((r) => ({
    slug: r.slug as LegalSlug,
    title: currentValues(r).title,
    at: r.reviewRequestedAt!.getTime(),
  }));
}

// Database work for the legal pages, shared by the server functions and the
// integration tests. The typed columns are the live version; edits wait in
// `draft` until an admin publishes them.
import { type LegalSlug, type LegalValues, legalPath, legalPublishErrors } from '@ll/content';
import type { Db } from '@ll/db';
import { legalPages, publishEvents, revisions, user } from '@ll/db/schema';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
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

export async function saveLegalDraft(
  db: Db,
  slug: LegalSlug,
  values: LegalValues,
  expectedUpdatedAt: number,
  actor: Actor
) {
  const row = await loadLegalPage(db, slug);
  assertVersion(row, expectedUpdatedAt);
  const now = new Date();
  await db
    .update(legalPages)
    .set({ draft: values, updatedAt: now, updatedBy: actor.id })
    .where(eq(legalPages.id, row.id));
  return { updatedAt: now.getTime() };
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
  await db.batch([
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
      .where(eq(legalPages.id, row.id)),
    db.insert(revisions).values({
      entityType: 'legal_page',
      entityId: row.id,
      snapshot: values,
      createdBy: actor.id,
      createdAt: now,
    }),
    db.insert(publishEvents).values({
      entityType: 'legal_page',
      entityId: row.id,
      action: 'publish',
      paths: [legalPath(slug)],
    }),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'legal_page.published',
      summary: `Published ${values.title}`,
    }),
  ]);
  return { updatedAt: now.getTime(), lastPublishedAt: now.getTime() };
}

export async function discardLegalDraft(db: Db, slug: LegalSlug, actor: Actor) {
  const row = await loadLegalPage(db, slug);
  const now = new Date();
  await db
    .update(legalPages)
    .set({ draft: null, reviewRequestedAt: null, updatedAt: now, updatedBy: actor.id })
    .where(eq(legalPages.id, row.id));
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

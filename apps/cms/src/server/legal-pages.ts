import { can, legalSlugSchema, legalValuesSchema } from '@ll/content';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import {
  currentValues,
  discardLegalDraft,
  listLegalHistory,
  listLegalPageSummaries,
  loadLegalPage,
  loadLegalRevision,
  publishLegalDraft,
  requestLegalReview,
  restoreLegalRevision,
  saveLegalDraft,
} from './legal-page-store';

const slugInput = z.object({ slug: legalSlugSchema });
const actorOf = (user: { id: string; name: string }) => ({ id: user.id, name: user.name });

export const listLegalPages = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .handler(() => listLegalPageSummaries(getDb()));

export const getLegalPageEditorData = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput)
  .handler(async ({ data }) => {
    const db = getDb();
    const row = await loadLegalPage(db, data.slug);
    return {
      id: row.id,
      slug: data.slug,
      values: currentValues(row),
      hasDraft: row.draft !== null,
      updatedAt: row.updatedAt.getTime(),
      reviewRequestedAt: row.reviewRequestedAt?.getTime() ?? null,
      lastPublishedAt: row.lastPublishedAt?.getTime() ?? null,
      history: await listLegalHistory(db, row.id),
    };
  });

export type LegalPageEditorData = Awaited<ReturnType<typeof getLegalPageEditorData>>;

export const saveLegalPage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput.extend({ values: legalValuesSchema, expectedUpdatedAt: z.number() }))
  .handler(({ data, context }) =>
    saveLegalDraft(
      getDb(),
      data.slug,
      data.values,
      data.expectedUpdatedAt,
      actorOf(context.user),
      can(context.user.role, 'legal:publish')
    )
  );

export const requestLegalPageReview = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput)
  .handler(({ data, context }) => requestLegalReview(getDb(), data.slug, actorOf(context.user)));

export const publishLegalPage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('legal:publish')])
  .validator(slugInput.extend({ expectedUpdatedAt: z.number() }))
  .handler(({ data, context }) =>
    publishLegalDraft(getDb(), data.slug, data.expectedUpdatedAt, actorOf(context.user))
  );

export const discardLegalPageDraft = createServerFn({ method: 'POST' })
  .middleware([requirePermission('legal:publish')])
  .validator(slugInput.extend({ expectedUpdatedAt: z.number() }))
  .handler(({ data, context }) =>
    discardLegalDraft(getDb(), data.slug, data.expectedUpdatedAt, actorOf(context.user))
  );

export const restoreLegalVersion = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput.extend({ revisionId: z.string().max(64), expectedUpdatedAt: z.number() }))
  .handler(({ data, context }) =>
    restoreLegalRevision(
      getDb(),
      data.slug,
      data.revisionId,
      data.expectedUpdatedAt,
      actorOf(context.user),
      can(context.user.role, 'legal:publish')
    )
  );

export const getLegalRevision = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(({ data }) => loadLegalRevision(getDb(), data.id));

// Drafts are unpublished legal text: only people who can edit them may read them.
export const getLegalPagePreview = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput)
  .handler(async ({ data }) => {
    const row = await loadLegalPage(getDb(), data.slug);
    const values = currentValues(row);
    return { title: values.title, body: values.body, hasDraft: row.draft !== null };
  });

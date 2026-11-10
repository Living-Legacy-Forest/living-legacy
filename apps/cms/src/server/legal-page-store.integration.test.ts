import { activityLog, legalPages, publishEvents, revisions } from '@ll/db/schema';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import {
  discardLegalDraft,
  listLegalHistory,
  listLegalReviewRequests,
  loadLegalPage,
  loadLegalRevision,
  publishLegalDraft,
  requestLegalReview,
  saveLegalDraft,
} from './legal-page-store';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const values = (text: string) => ({ title: 'Privacy policy', body: doc(text), seoDescription: '' });

let actor = { id: '', name: 'Sam Tester' };
const version = async () => (await loadLegalPage(testDb(), 'privacy')).updatedAt.getTime();

describe('legal pages', () => {
  beforeEach(async () => {
    const db = testDb();
    // The seed migration made both rows; put privacy back to "no pending edits".
    await db.update(legalPages).set({ draft: null, reviewRequestedAt: null });
    await db.delete(publishEvents);
    await db.delete(activityLog);
    await db.delete(revisions).where(eq(revisions.entityType, 'legal_page'));
    actor = { id: await addUser('admin'), name: 'Sam Tester' };
  });

  it('saves edits as a draft without changing the live text', async () => {
    const before = await loadLegalPage(testDb(), 'privacy');
    await saveLegalDraft(testDb(), 'privacy', values('New wording'), await version(), actor);
    const after = await loadLegalPage(testDb(), 'privacy');
    expect(after.body).toEqual(before.body);
    expect(after.draft).toMatchObject({ body: doc('New wording') });
  });

  it('refuses a save from an out-of-date editor', async () => {
    const stale = await version();
    await saveLegalDraft(testDb(), 'privacy', values('First'), stale, actor);
    await expect(
      saveLegalDraft(testDb(), 'privacy', values('Second'), stale, actor)
    ).rejects.toThrow('Someone else saved this page');
  });

  it('publishes the draft and records it', async () => {
    await saveLegalDraft(testDb(), 'privacy', values('Published wording'), await version(), actor);
    await requestLegalReview(testDb(), 'privacy', actor);
    const { lastPublishedAt } = await publishLegalDraft(
      testDb(),
      'privacy',
      await version(),
      actor
    );

    const row = await loadLegalPage(testDb(), 'privacy');
    expect(row.body).toEqual(doc('Published wording'));
    expect(row.draft).toBeNull();
    expect(row.reviewRequestedAt).toBeNull();
    expect(row.lastPublishedAt?.getTime()).toBe(lastPublishedAt);

    const history = await listLegalHistory(testDb(), row.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.by).toBe('Sam Tester');
    expect((await loadLegalRevision(testDb(), history[0]!.id)).body).toEqual(
      doc('Published wording')
    );

    const events = await testDb().select().from(publishEvents);
    expect(events).toEqual([
      expect.objectContaining({ entityType: 'legal_page', paths: ['/privacy/'] }),
    ]);
    const logged = await testDb()
      .select()
      .from(activityLog)
      .where(
        and(eq(activityLog.action, 'legal_page.published'), eq(activityLog.actorId, actor.id))
      );
    expect(logged).toHaveLength(1);
  });

  it('refuses to publish with no changes', async () => {
    await expect(publishLegalDraft(testDb(), 'privacy', await version(), actor)).rejects.toThrow(
      'There are no changes to publish.'
    );
  });

  it('refuses to publish an empty page', async () => {
    await saveLegalDraft(
      testDb(),
      'privacy',
      { title: 'Privacy policy', body: null, seoDescription: '' },
      await version(),
      actor
    );
    await expect(publishLegalDraft(testDb(), 'privacy', await version(), actor)).rejects.toThrow(
      'Add the page text before publishing.'
    );
  });

  it('refuses a publish from an out-of-date editor', async () => {
    const stale = await version();
    await saveLegalDraft(testDb(), 'privacy', values('Draft'), stale, actor);
    await expect(publishLegalDraft(testDb(), 'privacy', stale, actor)).rejects.toThrow(
      'Someone else saved this page'
    );
  });

  it('discarding drops the draft and the review request', async () => {
    await saveLegalDraft(testDb(), 'privacy', values('Draft'), await version(), actor);
    await requestLegalReview(testDb(), 'privacy', actor);
    await discardLegalDraft(testDb(), 'privacy', actor);
    const row = await loadLegalPage(testDb(), 'privacy');
    expect(row.draft).toBeNull();
    expect(row.reviewRequestedAt).toBeNull();
  });

  it('lists review requests for the bell', async () => {
    await saveLegalDraft(testDb(), 'privacy', values('Draft'), await version(), actor);
    await requestLegalReview(testDb(), 'privacy', actor);
    expect(await listLegalReviewRequests(testDb())).toEqual([
      expect.objectContaining({ slug: 'privacy', title: 'Privacy policy' }),
    ]);
  });

  it('refuses a review request with nothing to review', async () => {
    await expect(requestLegalReview(testDb(), 'privacy', actor)).rejects.toThrow(
      'Save your changes before asking for a review.'
    );
  });
});

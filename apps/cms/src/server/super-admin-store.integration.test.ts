// What only a super admin may do to the activity log and the writing assistant, against local D1.
import { activityLog, aiUsage } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { clearActivityEntries, resetAssistantCounts } from './super-admin-store';

let actor: { id: string; name: string };

beforeEach(async () => {
  await testDb().delete(activityLog);
  await testDb().delete(aiUsage);
  actor = { id: await addUser('admin', 'Boss'), name: 'Boss' };
});

describe('clearActivityEntries', () => {
  it('removes every entry and leaves one saying who did it', async () => {
    await testDb()
      .insert(activityLog)
      .values([
        { actorName: 'Sam', action: 'post.published', summary: 'Published a post' },
        { actorName: 'Sam', action: 'redirect.created', summary: 'Added a redirect' },
        { actorName: 'Sam', action: 'user.removed', summary: 'Removed someone' },
      ]);

    const cleared = await clearActivityEntries(testDb(), actor);

    expect(cleared).toBe(3);
    const rows = await testDb().select().from(activityLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'activity.cleared',
      actorName: 'Boss',
      summary: 'Cleared the activity log (3 entries)',
    });
  });

  it('still leaves its note when the log was already empty', async () => {
    expect(await clearActivityEntries(testDb(), actor)).toBe(0);
    const rows = await testDb().select().from(activityLog);
    expect(rows.map((r) => r.summary)).toEqual(['Cleared the activity log (0 entries)']);
  });

  it('says "1 entry" for a single entry', async () => {
    await testDb()
      .insert(activityLog)
      .values({ actorName: 'Sam', action: 'post.published', summary: 'Published a post' });
    await clearActivityEntries(testDb(), actor);
    const rows = await testDb().select().from(activityLog);
    expect(rows[0]?.summary).toBe('Cleared the activity log (1 entry)');
  });
});

describe('resetAssistantCounts', () => {
  it('removes every person and day of usage and logs it', async () => {
    const a = await addUser('editor', 'Ann');
    const b = await addUser('author', 'Ben');
    await testDb()
      .insert(aiUsage)
      .values([
        { userId: a, day: '2026-11-20', count: 4, inputTokens: 900 },
        { userId: a, day: '2026-11-19', count: 2 },
        { userId: b, day: '2026-11-20', count: 7, failed: 1 },
      ]);

    const removed = await resetAssistantCounts(testDb(), actor);

    expect(removed).toBe(3);
    expect(await testDb().select().from(aiUsage)).toHaveLength(0);
    const log = await testDb().select().from(activityLog);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: 'settings.assistant_reset',
      actorName: 'Boss',
      summary: 'Reset the writing assistant usage',
    });
  });

  it('works when there is no usage yet', async () => {
    expect(await resetAssistantCounts(testDb(), actor)).toBe(0);
    expect(await testDb().select().from(activityLog)).toHaveLength(1);
  });
});

import { activityLog, posts, publishEvents, redirects } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, days, minutes, testDb } from '../../test/fixtures';
import { liveInput, publishValues, uniqueSlug } from './post-store';
import { publishDuePosts } from './scheduler';

const now = new Date('2027-01-20T09:00:00Z');

async function addPost(values: Partial<typeof posts.$inferInsert> & { slug: string }) {
  const [row] = await testDb()
    .insert(posts)
    .values({ title: 'A post', ...values })
    .returning();
  return row!;
}

const find = async (id: string) =>
  (await testDb().query.posts.findFirst({ where: eq(posts.id, id) }))!;

beforeEach(async () => {
  const db = testDb();
  await db.delete(posts);
  await db.delete(activityLog);
  await db.delete(publishEvents);
  await db.delete(redirects);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('publishDuePosts', () => {
  it('publishes a draft whose time has come, credited to whoever scheduled it', async () => {
    const userId = await addUser('editor', 'Robin Editor');
    const due = await addPost({
      slug: 'planting-day',
      scheduledAt: new Date(now.getTime() - minutes(3)),
      updatedBy: userId,
    });

    expect(await publishDuePosts(env.DB, now)).toEqual({ published: 1, failed: 0 });

    const after = await find(due.id);
    expect(after.status).toBe('published');
    expect(after.scheduledAt).toBeNull();
    expect(after.publishedAt).not.toBeNull();
    expect(after.updatedBy).toBe(userId);

    const [event] = await testDb().select().from(publishEvents);
    expect(event).toMatchObject({ entityId: due.id, paths: ['/blog/planting-day', '/blog'] });
    const [entry] = await testDb().select().from(activityLog);
    expect(entry).toMatchObject({ action: 'post.published', actorName: 'Robin Editor' });
  });

  it('leaves future, trashed and already published posts alone', async () => {
    const future = await addPost({ slug: 'later', scheduledAt: new Date(now.getTime() + days(1)) });
    const trashed = await addPost({
      slug: 'binned',
      scheduledAt: new Date(now.getTime() - days(1)),
      deletedAt: new Date(now.getTime() - minutes(5)),
    });

    expect(await publishDuePosts(env.DB, now)).toEqual({ published: 0, failed: 0 });
    expect((await find(future.id)).status).toBe('draft');
    expect((await find(trashed.id)).status).toBe('draft');
  });

  it('unschedules a post that cannot be published, instead of retrying it forever', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const untitled = await addPost({
      title: '',
      slug: 'no-title',
      scheduledAt: new Date(now.getTime() - minutes(1)),
    });

    expect(await publishDuePosts(env.DB, now)).toEqual({ published: 0, failed: 1 });
    const after = await find(untitled.id);
    expect(after.status).toBe('draft');
    expect(after.scheduledAt).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Add a title before publishing.'));
  });

  it('publishes the rest when one post fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const past = new Date(now.getTime() - minutes(1));
    await addPost({ title: '', slug: 'broken', scheduledAt: past });
    const good = await addPost({ slug: 'fine', scheduledAt: past });

    expect(await publishDuePosts(env.DB, now)).toEqual({ published: 1, failed: 1 });
    expect((await find(good.id)).status).toBe('published');
  });
});

describe('publishing a post', () => {
  it('redirects the old permalink when a live post changes it', async () => {
    const live = await addPost({ slug: 'old-name', status: 'published', publishedAt: now });
    await testDb()
      .insert(redirects)
      .values({ fromPath: '/blog/older-name', toPath: '/blog/old-name', statusCode: 301 });

    const input = await liveInput(testDb(), live);
    await publishValues(testDb(), live, { ...input, slug: 'new-name' }, null);

    const rows = await testDb().select().from(redirects);
    expect(rows.map((r) => [r.fromPath, r.toPath]).sort()).toEqual([
      // Earlier redirects skip the hop and go straight to the new address.
      ['/blog/old-name', '/blog/new-name'],
      ['/blog/older-name', '/blog/new-name'],
    ]);
  });

  it('numbers a permalink another post already uses', async () => {
    await addPost({ slug: 'open-day' });
    await addPost({ slug: 'open-day-2' });
    expect(await uniqueSlug(testDb(), 'open-day')).toBe('open-day-3');
  });

  it('lets a post reuse the permalink of one in the trash', async () => {
    await addPost({ slug: 'open-day', deletedAt: now });
    expect(await uniqueSlug(testDb(), 'open-day')).toBe('open-day');
  });
});

import { type PostInput, emptyPostInput } from '@ll/content';
import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { avatarKey } from '@/lib/avatars';
import {
  applyWrite,
  createPostSchema,
  describeIssues,
  postSummary,
  updatePostSchema,
} from './api-v1';
import { mediaIdFromPath } from './media-delivery';
import type { PostRow } from './post-store';

beforeAll(() => {
  env.BETTER_AUTH_URL = 'https://cms.example.test';
});

const row = (overrides: Partial<PostRow> = {}): PostRow => ({
  id: 'p1',
  title: 'Planting day',
  slug: 'planting-day',
  excerpt: null,
  body: null,
  featuredMediaId: null,
  authorId: null,
  seoTitle: null,
  seoDescription: null,
  ogMediaId: null,
  noindex: false,
  focusKeyword: null,
  relatedTerms: [],
  contentScore: null,
  scheduledAt: null,
  reviewRequestedAt: null,
  reviewerId: null,
  status: 'draft',
  draft: null,
  publishedAt: null,
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

describe('postSummary', () => {
  it('gives a live post its public URL', () => {
    const summary = postSummary(row({ status: 'published', publishedAt: new Date(0) }));
    expect(summary.status).toBe('published');
    expect(summary.url).toBe('https://livinglegacy.com.au/blog/planting-day/');
    expect(summary.editUrl).toBe('https://cms.example.test/posts/p1');
  });

  it('tells drafts, scheduled and trashed posts apart, with no public URL', () => {
    expect(postSummary(row()).status).toBe('draft');
    expect(postSummary(row({ scheduledAt: new Date(1) })).status).toBe('scheduled');
    const trashed = postSummary(row({ status: 'published', deletedAt: new Date(1) }));
    expect(trashed.status).toBe('trashed');
    expect(trashed.url).toBeNull();
  });

  it('flags edits waiting on a published post', () => {
    expect(postSummary(row({ draft: { title: 'New' } })).hasUnpublishedChanges).toBe(true);
  });
});

describe('API write schemas', () => {
  it('requires a title to create a post', () => {
    const result = createPostSchema.safeParse({ markdown: 'Hello' });
    expect(result.success).toBe(false);
    expect(describeIssues(result.error!)).toBe('title: A title is required.');
  });

  it('refuses markdown and body together', () => {
    const result = updatePostSchema.safeParse({ markdown: 'a', body: null });
    expect(describeIssues(result.error!)).toBe('Send either markdown or body, not both.');
  });

  it('refuses fields it does not know', () => {
    expect(updatePostSchema.safeParse({ status: 'published' }).success).toBe(false);
  });
});

describe('applyWrite', () => {
  const base: PostInput = {
    ...emptyPostInput,
    title: 'Old title',
    slug: 'old-title',
    excerpt: 'Kept',
  };

  it('changes only the fields sent', () => {
    const next = applyWrite(base, { title: 'New title' });
    expect(next.title).toBe('New title');
    expect(next.slug).toBe('old-title');
    expect(next.excerpt).toBe('Kept');
  });

  it('turns markdown into the editor body', () => {
    const next = applyWrite(base, { markdown: 'Hello **world**' });
    expect(JSON.stringify(next.body)).toContain('"world"');
    expect(JSON.stringify(next.body)).toContain('"bold"');
  });
});

describe('media paths', () => {
  it('reads the id from /api/media/:id only', () => {
    expect(mediaIdFromPath('/api/media/01J0ABC-x_y')).toBe('01J0ABC-x_y');
    expect(mediaIdFromPath('/api/media/')).toBeNull();
    expect(mediaIdFromPath('/api/media/a/b')).toBeNull();
    expect(mediaIdFromPath('/media/abc')).toBeNull();
  });

  it('reads the storage key from an avatar URL only', () => {
    expect(avatarKey('/api/avatar/avatar-123.webp')).toBe('avatar-123.webp');
    expect(avatarKey('https://lh3.googleusercontent.com/a/photo')).toBeNull();
    expect(avatarKey(null)).toBeNull();
  });
});

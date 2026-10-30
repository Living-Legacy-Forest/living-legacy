import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';
import { id, lifecycle, richText, timestamps } from './columns';

export const media = sqliteTable('media', {
  id: id(),
  r2Key: text('r2_key').notNull().unique(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  alt: text('alt'),
  caption: text('caption'),
  uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps(),
});

export const teamMembers = sqliteTable('team_members', {
  id: id(),
  name: text('name').notNull(),
  role: text('role'),
  bio: richText('bio'),
  photoMediaId: text('photo_media_id').references(() => media.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  ...lifecycle(),
});

export const posts = sqliteTable(
  'posts',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    excerpt: text('excerpt'),
    body: richText('body'),
    featuredMediaId: text('featured_media_id').references(() => media.id, { onDelete: 'set null' }),
    authorId: text('author_id').references(() => teamMembers.id, { onDelete: 'set null' }),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    ogMediaId: text('og_media_id').references(() => media.id, { onDelete: 'set null' }),
    noindex: integer('noindex', { mode: 'boolean' }).notNull().default(false),
    /** When a draft goes live on its own; cleared on publish, unschedule or trash. */
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }),
    // Set when an author asks for review; publishing clears it.
    reviewRequestedAt: integer('review_requested_at', { mode: 'timestamp_ms' }),
    ...lifecycle(),
  },
  (t) => [
    // Slugs only need to be unique among posts that are not in the trash.
    uniqueIndex('posts_slug_live')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('posts_status_published_at').on(t.status, t.publishedAt),
    // The scheduler looks up due drafts every few minutes.
    index('posts_scheduled_at').on(t.scheduledAt),
  ]
);

export const terms = sqliteTable(
  'terms',
  {
    id: id(),
    type: text('type', { enum: ['category', 'tag'] }).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    parentId: text('parent_id').references((): AnySQLiteColumn => terms.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('terms_type_slug').on(t.type, t.slug)]
);

export const postTerms = sqliteTable(
  'post_terms',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    termId: text('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.termId] }), index('post_terms_term').on(t.termId)]
);

export const faqGroups = sqliteTable('faq_groups', {
  id: id(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

export const faqs = sqliteTable('faqs', {
  id: id(),
  question: text('question').notNull(),
  answer: richText('answer'),
  groupId: text('group_id').references(() => faqGroups.id, { onDelete: 'set null' }),
  // Where the FAQ appears, as tag codes like "home" or "pricing"; the website
  // picks FAQs for a page by tag.
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  ...lifecycle(),
});

export const testimonials = sqliteTable('testimonials', {
  id: id(),
  quote: text('quote').notNull(),
  name: text('name').notNull(),
  relationship: text('relationship'),
  location: text('location'),
  photoMediaId: text('photo_media_id').references(() => media.id, { onDelete: 'set null' }),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  ...lifecycle(),
});

// Site-wide notice bars. Several can be prepared ahead; the website shows the
// one whose window covers now (see currentAnnouncement in @llf/content).
export const announcements = sqliteTable(
  'announcements',
  {
    id: id(),
    /** Internal name, e.g. "November tree upgrade". Not shown on the site. */
    title: text('title').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    /** Shown on phones, and on larger screens unless overridden below. */
    message: text('message').notNull(),
    messageTablet: text('message_tablet'),
    messageDesktop: text('message_desktop'),
    ctaLabel: text('cta_label'),
    ctaUrl: text('cta_url'),
    background: text('background', { enum: ['moss', 'ink', 'sun', 'paper'] })
      .notNull()
      .default('moss'),
    /** Blank start shows it as soon as it is enabled; blank end never expires. */
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }),
    endsAt: integer('ends_at', { mode: 'timestamp_ms' }),
    /** Page paths where the bar is hidden, e.g. /events/open-days. */
    hidePaths: text('hide_paths', { mode: 'json' }).$type<string[]>().notNull().default([]),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('announcements_starts_at').on(t.startsAt)]
);

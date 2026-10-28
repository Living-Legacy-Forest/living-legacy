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
    ...lifecycle(),
  },
  (t) => [
    // Slugs only need to be unique among posts that are not in the trash.
    uniqueIndex('posts_slug_live')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('posts_status_published_at').on(t.status, t.publishedAt),
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

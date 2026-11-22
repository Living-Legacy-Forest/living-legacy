import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { MediaVariant } from '../enums';
import { user } from './auth';
import { id, lifecycle, richText, timestamps } from './columns';

export const media = sqliteTable(
  'media',
  {
    id: id(),
    r2Key: text('r2_key').notNull().unique(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    // Smaller copies made in the browser at upload, served for `?w=`. Images
    // uploaded before these existed have none and are served full size.
    variants: text('variants', { mode: 'json' }).$type<MediaVariant[]>(),
    alt: text('alt'),
    caption: text('caption'),
    // The part of an image to keep in view when it is cropped to a shape, as 0 to 1 across and
    // down. Empty means the centre.
    focalX: real('focal_x'),
    focalY: real('focal_y'),
    // Free-form labels for finding files, lower case.
    tags: text('tags', { mode: 'json' }).$type<string[]>(),
    uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    // Set while the file is in the trash: hidden from the library and the website, its stored
    // objects kept so it can be restored. A daily job deletes it for good after a while
    // (MEDIA_TRASH_DAYS in @ll/content).
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    deletedBy: text('deleted_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  // The library and the image picker page through files newest first.
  (t) => [index('media_created').on(t.createdAt, t.id)]
);

// Files a Media entry used to point at, kept when its file is replaced so the change can be
// undone. Each holds its own stored objects (and smaller copies), removed with the entry.
export const mediaVersions = sqliteTable(
  'media_versions',
  {
    id: id(),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull().unique(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    variants: text('variants', { mode: 'json' }).$type<MediaVariant[]>(),
    /** Who replaced it, so the history says who changed what. */
    replacedBy: text('replaced_by').references(() => user.id, { onDelete: 'set null' }),
    /** When this file was replaced (it stopped being the current one). */
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('media_versions_media').on(t.mediaId, t.createdAt)]
);

export const teamMembers = sqliteTable('team_members', {
  id: id(),
  name: text('name').notNull(),
  role: text('role'),
  bio: richText('bio'),
  photoMediaId: text('photo_media_id').references(() => media.id, { onDelete: 'set null' }),
  /** A chosen drawn avatar (DiceBear seed), shown when there is no photo. */
  avatarSeed: text('avatar_seed'),
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
    /** The forest the post is about, if any. */
    locationId: text('location_id').references((): AnySQLiteColumn => locations.id, {
      onDelete: 'set null',
    }),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    ogMediaId: text('og_media_id').references(() => media.id, { onDelete: 'set null' }),
    noindex: integer('noindex', { mode: 'boolean' }).notNull().default(false),
    /** Where search engines should treat the post as living, if not its own URL. */
    canonicalUrl: text('canonical_url'),
    /** The share card's own wording; empty uses the search title and description. */
    socialTitle: text('social_title'),
    socialDescription: text('social_description'),
    // Finer robots directives, for when the post is indexed.
    nofollow: integer('nofollow', { mode: 'boolean' }).notNull().default(false),
    nosnippet: integer('nosnippet', { mode: 'boolean' }).notNull().default(false),
    noimageindex: integer('noimageindex', { mode: 'boolean' }).notNull().default(false),
    focusKeyword: text('focus_keyword'),
    /** The content score of the post's columns (its live version once published). Advice only. */
    contentScore: integer('content_score'),
    relatedTerms: text('related_terms', { mode: 'json' }).$type<string[]>().notNull().default([]),
    /** When a draft goes live on its own; cleared on publish, unschedule or trash. */
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }),
    // Set when an author asks for review; publishing clears it.
    reviewRequestedAt: integer('review_requested_at', { mode: 'timestamp_ms' }),
    // Who was asked to review it; blank means anyone who can publish.
    reviewerId: text('reviewer_id').references(() => user.id, { onDelete: 'set null' }),
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

/** The privacy policy and the terms: live columns, pending edits in `draft`. */
export const legalPages = sqliteTable('legal_pages', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: richText('body'),
  seoDescription: text('seo_description'),
  /** Set on every publish; drives "Last updated". `publishedAt` is the first publish. */
  lastPublishedAt: integer('last_published_at', { mode: 'timestamp_ms' }),
  reviewRequestedAt: integer('review_requested_at', { mode: 'timestamp_ms' }),
  ...lifecycle(),
});

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
  /** The heading on the FAQs page. */
  name: text('name').notNull(),
  /** A shorter name for the page's side menu; blank uses the heading. */
  navLabel: text('nav_label'),
  /** The #anchor on the FAQs page; blank is made from the heading. */
  slug: text('slug'),
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

// Press and broadcast coverage for the "In the media" page.
export const mediaCoverage = sqliteTable(
  'media_coverage',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    kind: text('kind', { enum: ['article', 'video'] })
      .notNull()
      .default('article'),
    /** Drives the topic filter on the page, e.g. Science or Broadcast. */
    category: text('category'),
    /** The outlet, e.g. Herald Sun. */
    source: text('source').notNull(),
    /** When the outlet ran it. Not to be confused with `publishedAt`, when it went live here. */
    coverageDate: integer('coverage_date', { mode: 'timestamp_ms' }),
    excerpt: text('excerpt'),
    readingMinutes: integer('reading_minutes'),
    imageMediaId: text('image_media_id').references(() => media.id, { onDelete: 'set null' }),
    externalUrl: text('external_url').notNull(),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...lifecycle(),
  },
  (t) => [
    uniqueIndex('media_coverage_slug_live')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

// The national location directory and each location's page.
export const locations = sqliteTable(
  'locations',
  {
    id: id(),
    /** The public name, e.g. Living Legacy Mornington. */
    name: text('name').notNull(),
    /** The page lives at /locations/{slug}/. */
    slug: text('slug').notNull(),
    /** A filter in the directory, never a page of its own. */
    state: text('state', { enum: ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'] }).notNull(),
    /** e.g. Mornington Peninsula. */
    region: text('region'),
    stage: text('stage', { enum: ['live', 'external', 'coming_soon'] })
      .notNull()
      .default('coming_soon'),
    /** The location's own website while it has not moved here. */
    externalUrl: text('external_url'),
    heroMediaId: text('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
    /** A sentence or two for the directory card. */
    intro: text('intro'),
    /** The local introduction on its page, in Markdown. */
    about: text('about'),
    address: text('address'),
    /** Where the map pin goes. */
    latitude: real('latitude'),
    longitude: real('longitude'),
    mapUrl: text('map_url'),
    /** Free text, one line per day or range. */
    hours: text('hours'),
    phone: text('phone'),
    email: text('email'),
    /** The HubSpot form its enquiries and tour bookings go to. */
    hubspotFormId: text('hubspot_form_id'),
    /** Search listing and share card; each falls back to the name, intro and hero photo. */
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    ogMediaId: text('og_media_id').references(() => media.id, { onDelete: 'set null' }),
    /** Keeps a live location's page out of search results and the sitemap. */
    noindex: integer('noindex', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...lifecycle(),
  },
  (t) => [
    uniqueIndex('locations_slug_live')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ]
);

// Site-wide notice bars. Several can be prepared ahead; the website shows the
// one whose window covers now (see currentAnnouncement in @ll/content).
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
    /** A palette name (moss, ink, sun, paper) or a hex colour; see @ll/content announcements. */
    background: text('background').notNull().default('moss'),
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

/**
 * Who has a post open in the editor, for the "also editing" notice. Each open
 * editor checks in every 20 seconds; a row older than a minute or two means
 * they have gone. Nothing is locked.
 */
export const postPresence = sqliteTable(
  'post_presence',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    seenAt: integer('seen_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index('post_presence_seen').on(t.seenAt)]
);

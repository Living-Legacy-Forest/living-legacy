import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';
import { id, richText, timestamps } from './columns';
import { locations, media } from './content';

// Free events (open days) and the places people book on them. The booking
// rules live in @ll/content (events.ts). Guest emails are sent by HubSpot, not
// the CMS: bookings sync there (crm_* columns). Bookings are personal details
// and are deleted a year after the event (CMS daily cron).

export const events = sqliteTable(
  'events',
  {
    id: id(),
    /** Links the dates of a repeating event; each date is its own event. */
    seriesId: text('series_id'),
    title: text('title').notNull(),
    /**
     * Its page will be /events/{slug}/ once the website has event pages. The dates
     * of a repeating event share one, so it is unique per event, not per row
     * (checked on save, as an index cannot say "unique outside its series").
     */
    slug: text('slug').notNull(),
    locationId: text('location_id').references(() => locations.id, { onDelete: 'set null' }),
    /** Where to go; the form suggests the location's address. */
    venue: text('venue'),
    /** Its times are in this zone: its location's state, unless changed. */
    timeZone: text('time_zone').notNull().default('Australia/Melbourne'),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    endsAt: integer('ends_at', { mode: 'timestamp_ms' }).notNull(),
    summary: text('summary'),
    /** Rich text (Tiptap JSON), like a post's body. */
    description: richText('description'),
    /** The cover, the first of its photos. */
    heroMediaId: text('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
    /** The rest of its photos, in order. Media's "still used" check guards them. */
    galleryMediaIds: text('gallery_media_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Total people; null is no limit. */
    capacity: integer('capacity'),
    maxPartySize: integer('max_party_size').notNull().default(6),
    /** Website bookings close here, or at the start. */
    /** Online bookings open then; null means as soon as it is published. */
    bookingsOpenAt: integer('bookings_open_at', { mode: 'timestamp_ms' }),
    bookingsCloseAt: integer('bookings_close_at', { mode: 'timestamp_ms' }),
    status: text('status', { enum: ['draft', 'published', 'cancelled'] })
      .notNull()
      .default('draft'),
    /** A draft set to go live then; the five-minute job publishes it. */
    publishAt: integer('publish_at', { mode: 'timestamp_ms' }),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    index('events_slug').on(t.slug),
    index('events_starts_at').on(t.startsAt),
    index('events_series').on(t.seriesId),
  ]
);

export const eventBookings = sqliteTable(
  'event_bookings',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    /** LL-XXXXXX, read out over the phone and quoted in emails. */
    reference: text('reference').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),
    partySize: integer('party_size').notNull(),
    /** Accessibility or dietary needs. */
    note: text('note'),
    status: text('status', { enum: ['confirmed', 'cancelled'] })
      .notNull()
      .default('confirmed'),
    source: text('source', { enum: ['website', 'staff'] }).notNull(),
    /** Hash of the website's self-cancel token (phase 2); the token is never stored. */
    manageTokenHash: text('manage_token_hash'),
    consentAt: integer('consent_at', { mode: 'timestamp_ms' }),
    checkedInAt: integer('checked_in_at', { mode: 'timestamp_ms' }),
    checkedInBy: text('checked_in_by').references(() => user.id, { onDelete: 'set null' }),
    // HubSpot, once connected: null crm_synced_at means not sent yet.
    crmSyncedAt: integer('crm_synced_at', { mode: 'timestamp_ms' }),
    crmContactId: text('crm_contact_id'),
    crmError: text('crm_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    uniqueIndex('event_bookings_reference').on(t.reference),
    index('event_bookings_event_status').on(t.eventId, t.status),
    index('event_bookings_email').on(t.email),
  ]
);

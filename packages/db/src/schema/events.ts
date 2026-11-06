import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';
import { id, timestamps } from './columns';
import { locations, media } from './content';

// Free events (open days) and the places people book on them. The booking
// rules live in @ll/content (events.ts); bookings are personal details and
// are deleted a year after the event (CMS daily cron).

export const events = sqliteTable(
  'events',
  {
    id: id(),
    title: text('title').notNull(),
    /** Its page will be /events/{slug}/ once the website has event pages. */
    slug: text('slug').notNull(),
    locationId: text('location_id').references(() => locations.id, { onDelete: 'set null' }),
    /** Where to go; the form suggests the location's address. */
    venue: text('venue'),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    endsAt: integer('ends_at', { mode: 'timestamp_ms' }).notNull(),
    summary: text('summary'),
    /** Markdown. */
    description: text('description'),
    heroMediaId: text('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
    /** Total people; null is no limit. */
    capacity: integer('capacity'),
    maxPartySize: integer('max_party_size').notNull().default(6),
    /** Website bookings close here, or at the start. */
    bookingsCloseAt: integer('bookings_close_at', { mode: 'timestamp_ms' }),
    status: text('status', { enum: ['draft', 'published', 'cancelled'] })
      .notNull()
      .default('draft'),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    /** Set when the day-before reminders are sent, so they go once. */
    reminderSentAt: integer('reminder_sent_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('events_slug').on(t.slug), index('events_starts_at').on(t.startsAt)]
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

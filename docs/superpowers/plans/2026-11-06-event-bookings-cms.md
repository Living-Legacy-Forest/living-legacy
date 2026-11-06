# Event bookings (CMS, phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff create free events in the CMS, add guests (phone bookings, walk-ins), check them in on a phone, export the list, and guests get confirmation, reminder and cancellation emails.

**Architecture:** Booking rules are pure functions in `@ll/content` (unit tested). Two new D1 tables in `@ll/db`. CMS server functions own all writes; a booking is inserted with one conditional `INSERT … SELECT` so capacity holds under concurrency. Emails go through the existing Resend helper; the 5-minute and daily crons send reminders, purge old bookings and call a dormant HubSpot sync.

**Tech Stack:** Bun monorepo, Drizzle on Cloudflare D1, TanStack Start (CMS), shadcn on Base UI, Tailwind 4, Vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-11-06-event-ticketing-design.md` (phase 1 only: no website pages, no service binding, no self-cancel link).

## Global Constraints

- CMS only. Do not touch `apps/web`.
- Capacity counts people (`party_size`), confirmed bookings only. `capacity` null means no limit.
- Website max party size default 6; staff may add up to 50 per booking.
- Booking reference format: `LL-` plus 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Bookings are deleted 365 days after their event ends.
- New permission `events:manage`: admin and editor only.
- Guest emails are sent from `EVENTS_EMAIL_FROM` = `Living Legacy <events@notify.livinglegacy.com.au>`, reply-to the location's email, else the site contact email.
- HubSpot: `crm_synced_at`, `crm_contact_id`, `crm_error` columns exist; `syncPending()` is a no-op unless `HUBSPOT_ACCESS_TOKEN` is set.
- Copy: Australian English, sentence case, no em or en dashes, no exclamation marks.
- Toasts go through `notify` / `useAction().run(action, { success, error })` (ESLint enforces).
- Icons from `@/components/icons` only. Tappable rows at least 44pt (`touch:min-h-11`).
- Commits: Conventional Commits, header ≤ 100 chars, body lines ≤ 100 chars.

## Review Focus

1. Two people adding the last places at the same moment: exactly one booking succeeds, the other gets "This event is fully booked." (Task 4, Step 6 check).
2. Lowering capacity below the people already booked must be refused with the number booked (Task 1 `capacityProblem` test, used by Task 3).
3. A 10:00 event in the site time zone (Melbourne, AEDT +11) shows as 10:00 in the CMS and email, and as `DTSTART:…T230000Z` the day before in the `.ics` (Task 1 test, Task 5 check).
4. The 5-minute cron running twice for the same event must not send two reminders (Task 6 claim-then-send, Task 6 check).
5. A walk-in with no email: confirmation option disabled, reminders skip them, CSV still lists them (Task 8 check).

---

### Task 1: Booking rules and the `events:manage` permission

**Files:**

- Create: `packages/content/src/events.ts`
- Create: `packages/content/src/events.test.ts`
- Modify: `packages/content/src/index.ts` (export)
- Modify: `packages/content/src/roles.ts` (permission + editor grant)
- Modify: `packages/content/src/roles.test.ts`

**Interfaces:**

- Produces:
  - `eventStatuses = ['draft','published','cancelled'] as const`, `type EventStatus`
  - `bookingStatuses = ['confirmed','cancelled'] as const`, `bookingSources = ['website','staff'] as const`
  - `DEFAULT_MAX_PARTY_SIZE = 6`, `STAFF_MAX_PARTY_SIZE = 50`, `BOOKING_RETENTION_DAYS = 365`
  - `type BookableEvent = { status: EventStatus; startsAt: number; endsAt: number; bookingsCloseAt: number | null; capacity: number | null; maxPartySize: number }`
  - `seatsTaken(bookings: { status: string; partySize: number }[]): number`
  - `bookingProblem(event: BookableEvent, partySize: number, taken: number, now: number, by: 'website' | 'staff'): string | null`
  - `capacityProblem(capacity: number | null, taken: number): string | null`
  - `bookingReference(bytes: Uint8Array): string`
  - `eventIcs(e: { uid: string; title: string; startsAt: number; endsAt: number; location: string; description: string; now: number }): string`
  - `eventInputSchema`, `guestInputSchema` (zod), `type EventInput`, `type GuestInput`

- [ ] **Step 1: Write the failing tests**

`packages/content/src/events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  type BookableEvent,
  bookingProblem,
  bookingReference,
  capacityProblem,
  eventIcs,
  seatsTaken,
} from './events';

const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 1, 0, 0); // 1 Nov 2026
const event = (over: Partial<BookableEvent> = {}): BookableEvent => ({
  status: 'published',
  startsAt: now + 48 * HOUR,
  endsAt: now + 50 * HOUR,
  bookingsCloseAt: null,
  capacity: 10,
  maxPartySize: 6,
  ...over,
});

describe('seatsTaken', () => {
  it('counts people in confirmed bookings only', () => {
    expect(
      seatsTaken([
        { status: 'confirmed', partySize: 3 },
        { status: 'cancelled', partySize: 4 },
        { status: 'confirmed', partySize: 2 },
      ])
    ).toBe(5);
  });
});

describe('bookingProblem', () => {
  it('accepts a booking that fits', () => {
    expect(bookingProblem(event(), 2, 5, now, 'website')).toBeNull();
  });

  it('refuses cancelled events for everyone', () => {
    expect(bookingProblem(event({ status: 'cancelled' }), 1, 0, now, 'staff')).toBe(
      'This event has been cancelled.'
    );
  });

  it('only lets the website book published events', () => {
    expect(bookingProblem(event({ status: 'draft' }), 1, 0, now, 'website')).toBe(
      'This event is not open for bookings.'
    );
    expect(bookingProblem(event({ status: 'draft' }), 1, 0, now, 'staff')).toBeNull();
  });

  it('closes website bookings at the close time, or the start', () => {
    const e = event({ bookingsCloseAt: now - HOUR });
    expect(bookingProblem(e, 1, 0, now, 'website')).toBe('Bookings for this event have closed.');
    expect(bookingProblem(event(), 1, 0, now + 49 * HOUR, 'website')).toBe(
      'Bookings for this event have closed.'
    );
  });

  it('lets staff add walk-ins until the event ends', () => {
    expect(bookingProblem(event(), 1, 0, now + 49 * HOUR, 'staff')).toBeNull();
    expect(bookingProblem(event(), 1, 0, now + 51 * HOUR, 'staff')).toBe(
      'This event has finished.'
    );
  });

  it('limits party size, more loosely for staff', () => {
    expect(bookingProblem(event(), 0, 0, now, 'staff')).toBe('Book at least one place.');
    expect(bookingProblem(event({ capacity: null }), 7, 0, now, 'website')).toBe(
      'Bookings are limited to 6 people.'
    );
    expect(bookingProblem(event({ capacity: null }), 12, 0, now, 'staff')).toBeNull();
    expect(bookingProblem(event({ capacity: null }), 51, 0, now, 'staff')).toBe(
      'Bookings are limited to 50 people.'
    );
  });

  it('says how many places are left', () => {
    expect(bookingProblem(event(), 2, 10, now, 'website')).toBe('This event is fully booked.');
    expect(bookingProblem(event(), 2, 9, now, 'website')).toBe('Only 1 place is left.');
    expect(bookingProblem(event(), 4, 7, now, 'website')).toBe('Only 3 places are left.');
  });

  it('has no limit without a capacity', () => {
    expect(bookingProblem(event({ capacity: null }), 6, 500, now, 'website')).toBeNull();
  });
});

describe('capacityProblem', () => {
  it('refuses a capacity below the people already booked', () => {
    expect(capacityProblem(8, 9)).toBe(
      '9 people are already booked. Set the capacity to at least 9.'
    );
    expect(capacityProblem(9, 9)).toBeNull();
    expect(capacityProblem(null, 900)).toBeNull();
  });
});

describe('bookingReference', () => {
  it('is LL- and six characters without look-alikes', () => {
    const ref = bookingReference(new Uint8Array([0, 1, 2, 30, 31, 62]));
    expect(ref).toBe('LL-ABC9AA');
    expect(bookingReference(crypto.getRandomValues(new Uint8Array(6)))).toMatch(
      /^LL-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/
    );
  });
});

describe('eventIcs', () => {
  const ics = eventIcs({
    uid: 'LL-ABC234@livinglegacy.com.au',
    title: 'Open day, Mornington',
    // 10:00 in Melbourne (AEDT, +11) on 7 Nov 2026 is 23:00 UTC on 6 Nov.
    startsAt: Date.UTC(2026, 10, 6, 23, 0),
    endsAt: Date.UTC(2026, 10, 7, 1, 0),
    location: '1 Forest Rd; Somerville VIC',
    description: 'Bring walking shoes.\nTea provided.',
    now: Date.UTC(2026, 10, 1, 0, 0),
  });

  it('uses UTC times and CRLF lines', () => {
    expect(ics).toContain('DTSTART:20261106T230000Z\r\n');
    expect(ics).toContain('DTEND:20261107T010000Z\r\n');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes commas, semicolons and new lines', () => {
    expect(ics).toContain('SUMMARY:Open day\\, Mornington');
    expect(ics).toContain('LOCATION:1 Forest Rd\\; Somerville VIC');
    expect(ics).toContain('DESCRIPTION:Bring walking shoes.\\nTea provided.');
  });

  it('folds lines longer than 75 characters', () => {
    const long = eventIcs({
      uid: 'x',
      title: 'A'.repeat(120),
      startsAt: 0,
      endsAt: HOUR,
      location: '',
      description: '',
      now: 0,
    });
    for (const line of long.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
    expect(long).toContain('\r\n A');
  });
});
```

Append to `packages/content/src/roles.test.ts` inside `describe('can', …)`:

```ts
it('lets admins and editors manage events and their guests', () => {
  expect(can('admin', 'events:manage')).toBe(true);
  expect(can('editor', 'events:manage')).toBe(true);
  expect(can('author', 'events:manage')).toBe(false);
  expect(can('seo', 'events:manage')).toBe(false);
  expect(can('viewer', 'events:manage')).toBe(false);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun run --filter @ll/content test`
Expected: FAIL, `Cannot find module './events'` and the `events:manage` type error.

- [ ] **Step 3: Implement**

`packages/content/src/events.ts`:

```ts
import { z } from 'zod';

// Free events (open days) and the bookings for them: the rules both the CMS
// and, later, the website apply. Times are epoch milliseconds.

export const eventStatuses = ['draft', 'published', 'cancelled'] as const;
export type EventStatus = (typeof eventStatuses)[number];
export const bookingStatuses = ['confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const bookingSources = ['website', 'staff'] as const;
export type BookingSource = (typeof bookingSources)[number];

export const DEFAULT_MAX_PARTY_SIZE = 6;
/** Staff add walk-ins and group phone bookings, so their limit is looser. */
export const STAFF_MAX_PARTY_SIZE = 50;
/** Bookings are personal details; they go this long after the event ends. */
export const BOOKING_RETENTION_DAYS = 365;

export type BookableEvent = {
  status: EventStatus;
  startsAt: number;
  endsAt: number;
  bookingsCloseAt: number | null;
  capacity: number | null;
  maxPartySize: number;
};

/** People in confirmed bookings. */
export function seatsTaken(bookings: { status: string; partySize: number }[]): number {
  return bookings.reduce((sum, b) => (b.status === 'confirmed' ? sum + b.partySize : sum), 0);
}

/** Why a booking of `partySize` cannot be made, or null if it can. */
export function bookingProblem(
  event: BookableEvent,
  partySize: number,
  taken: number,
  now: number,
  by: 'website' | 'staff'
): string | null {
  if (event.status === 'cancelled') return 'This event has been cancelled.';
  if (by === 'website') {
    if (event.status !== 'published') return 'This event is not open for bookings.';
    if (now >= (event.bookingsCloseAt ?? event.startsAt)) {
      return 'Bookings for this event have closed.';
    }
  } else if (now >= event.endsAt) {
    return 'This event has finished.';
  }

  if (!Number.isInteger(partySize) || partySize < 1) return 'Book at least one place.';
  const max = by === 'staff' ? STAFF_MAX_PARTY_SIZE : event.maxPartySize;
  if (partySize > max) return `Bookings are limited to ${max} people.`;

  if (event.capacity !== null) {
    const left = event.capacity - taken;
    if (left <= 0) return 'This event is fully booked.';
    if (partySize > left)
      return left === 1 ? 'Only 1 place is left.' : `Only ${left} places are left.`;
  }
  return null;
}

/** A new capacity must still hold everyone already booked. */
export function capacityProblem(capacity: number | null, taken: number): string | null {
  if (capacity === null || capacity >= taken) return null;
  return `${taken} people are already booked. Set the capacity to at least ${taken}.`;
}

// No 0/O, 1/I/L: references are read out over the phone.
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "LL-7K3QXM" from six random bytes. */
export function bookingReference(bytes: Uint8Array): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += REFERENCE_ALPHABET[(bytes[i] ?? 0) % REFERENCE_ALPHABET.length];
  }
  return `LL-${code}`;
}

const icsDate = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const icsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 characters continue on the next line after a space (RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`);
  return parts.join('\r\n');
}

/** An add-to-calendar file for one booking. */
export function eventIcs(e: {
  uid: string;
  title: string;
  startsAt: number;
  endsAt: number;
  location: string;
  description: string;
  now: number;
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Living Legacy//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.now)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

const optionalText = (max: number) => z.string().trim().max(max).default('');

export const eventInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, 'Give the event a title.').max(120),
    slug: optionalText(120),
    locationId: z.string().nullable(),
    venue: optionalText(300),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    summary: optionalText(200),
    description: optionalText(10_000),
    heroMediaId: z.string().nullable(),
    capacity: z.number().int().min(1).max(100_000).nullable(),
    maxPartySize: z.number().int().min(1).max(STAFF_MAX_PARTY_SIZE),
    bookingsCloseAt: z.number().int().nullable(),
    status: z.enum(['draft', 'published']),
  })
  .refine((e) => e.endsAt > e.startsAt, {
    path: ['endsAt'],
    message: 'The event must end after it starts.',
  })
  .refine((e) => e.bookingsCloseAt === null || e.bookingsCloseAt <= e.startsAt, {
    path: ['bookingsCloseAt'],
    message: 'Bookings must close before the event starts.',
  });
export type EventInput = z.infer<typeof eventInputSchema>;

export const guestInputSchema = z.object({
  eventId: z.string(),
  firstName: z.string().trim().min(1, 'Enter a first name.').max(60),
  lastName: optionalText(60),
  email: optionalText(200).refine(
    (v) => !v || z.string().email().safeParse(v).success,
    'That email address is not valid.'
  ),
  phone: optionalText(40),
  partySize: z.number().int().min(1).max(STAFF_MAX_PARTY_SIZE),
  note: optionalText(500),
  sendConfirmation: z.boolean().default(false),
});
export type GuestInput = z.infer<typeof guestInputSchema>;
```

`packages/content/src/index.ts`: add `export * from './events';`

`packages/content/src/roles.ts`: add to `permissions` after `'content:write',`:

```ts
  // Events and their guest lists (names, emails, phone numbers).
  'events:manage',
```

and change the editor grant to:

```ts
  editor: [
    'posts:write',
    'posts:publish',
    'seo:write',
    'content:write',
    'media:write',
    'events:manage',
  ],
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `bun run --filter @ll/content test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/content/src
git add packages/content/src
git commit -m "feat(content): event booking rules, calendar file and events permission"
```

---

### Task 2: Tables, migration and activity actions

**Files:**

- Create: `packages/db/src/schema/events.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/enums.ts` (activity actions)
- Create (generated): `packages/db/migrations/0017_events.sql`

**Interfaces:**

- Consumes: nothing from Task 1 (enums are written inline, as `locations.stage` is).
- Produces: `events`, `eventBookings` tables; activity actions `event.saved`, `event.cancelled`, `event.deleted`, `event.guest_added`, `event.guest_cancelled`.

- [ ] **Step 1: Write the schema**

`packages/db/src/schema/events.ts`:

```ts
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
```

Events are deleted outright (their bookings cascade), so there is no `deleted_at` and the slug index is plain.

`packages/db/src/schema/index.ts`: add `export * from './events';`

`packages/db/src/enums.ts`: add to `activityActions` before `] as const;`:

```ts
  'event.saved',
  'event.cancelled',
  'event.deleted',
  'event.guest_added',
  'event.guest_cancelled',
```

- [ ] **Step 2: Generate and apply the migration**

Run:

```bash
bun run --filter @ll/db generate -- --name events
bun run --filter @ll/cms db:migrate:local
```

Expected: `packages/db/migrations/0017_events.sql` with `CREATE TABLE events`, `CREATE TABLE event_bookings` and the four indexes; the local apply reports `0017_events.sql ✅`. Open the SQL and confirm nothing touches existing tables.

- [ ] **Step 3: Type-check**

Run: `bun run type-check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
bunx prettier --write packages/db/src
git add packages/db
git commit -m "feat(db): events and event bookings tables"
```

---

### Task 3: Event server functions

**Files:**

- Create: `apps/cms/src/server/events.ts`

**Interfaces:**

- Consumes: `eventInputSchema`, `capacityProblem`, `seatsTaken`, `slugify` (`@ll/content`); `events`, `eventBookings`, `locations` (`@ll/db/schema`); `logActivity`; `requirePermission`.
- Produces:
  - `listEvents()` → `{ events: EventRow[]; locations: LocationOption[] }`
    - `EventRow = { id; title; slug; locationId: string|null; locationName: string|null; venue: string; startsAt: number; endsAt: number; summary: string; description: string; heroMediaId: string|null; capacity: number|null; maxPartySize: number; bookingsCloseAt: number|null; status: 'draft'|'published'|'cancelled'; booked: number; bookings: number; checkedIn: number }`
    - `LocationOption = { id: string; name: string; address: string; email: string }`
  - `saveEvent(EventInput)` → `{ id: string }`
  - `cancelEvent({ id })` → `{ notified: number }` (emailing added in Task 5)
  - `deleteEvent({ id })` → `void`
  - `type EventsData`, `type EventRow`, `type LocationOption`

- [ ] **Step 1: Implement**

`apps/cms/src/server/events.ts`:

```ts
import { capacityProblem, eventInputSchema, slugify } from '@ll/content';
import { eventBookings, events, locations } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';

const confirmed = sql`${eventBookings.status} = 'confirmed'`;

export const listEvents = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .handler(async () => {
    const db = getDb();
    const [rows, places] = await db.batch([
      db
        .select({
          event: events,
          locationName: locations.name,
          booked: sql<number>`coalesce((select sum(${eventBookings.partySize}) from ${eventBookings} where ${eventBookings.eventId} = ${events.id} and ${confirmed}), 0)`,
          bookings: sql<number>`(select count(*) from ${eventBookings} where ${eventBookings.eventId} = ${events.id} and ${confirmed})`,
          checkedIn: sql<number>`coalesce((select sum(${eventBookings.partySize}) from ${eventBookings} where ${eventBookings.eventId} = ${events.id} and ${confirmed} and ${eventBookings.checkedInAt} is not null), 0)`,
        })
        .from(events)
        .leftJoin(locations, eq(events.locationId, locations.id))
        .orderBy(desc(events.startsAt)),
      db
        .select({
          id: locations.id,
          name: locations.name,
          address: locations.address,
          email: locations.email,
        })
        .from(locations)
        .where(isNull(locations.deletedAt))
        .orderBy(asc(locations.sortOrder), asc(locations.name)),
    ]);

    return {
      events: rows.map(({ event: e, locationName, booked, bookings, checkedIn }) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        locationId: e.locationId,
        locationName,
        venue: e.venue ?? '',
        startsAt: e.startsAt.getTime(),
        endsAt: e.endsAt.getTime(),
        summary: e.summary ?? '',
        description: e.description ?? '',
        heroMediaId: e.heroMediaId,
        capacity: e.capacity,
        maxPartySize: e.maxPartySize,
        bookingsCloseAt: e.bookingsCloseAt?.getTime() ?? null,
        status: e.status,
        booked: Number(booked),
        bookings: Number(bookings),
        checkedIn: Number(checkedIn),
      })),
      locations: places.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address ?? '',
        email: l.email ?? '',
      })),
    };
  });

export type EventsData = Awaited<ReturnType<typeof listEvents>>;
export type EventRow = EventsData['events'][number];
export type LocationOption = EventsData['locations'][number];

export const saveEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(eventInputSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const slug = slugify(data.slug || data.title);
    if (!slug) throw new Error('Give the event a title or a web address.');

    const clash = await db.query.events.findFirst({
      where: data.id ? and(eq(events.slug, slug), ne(events.id, data.id)) : eq(events.slug, slug),
    });
    if (clash) throw new Error('Another event already uses that web address. Change the slug.');

    const values = {
      title: data.title,
      slug,
      locationId: data.locationId,
      venue: data.venue || null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      summary: data.summary || null,
      description: data.description || null,
      heroMediaId: data.heroMediaId,
      capacity: data.capacity,
      maxPartySize: data.maxPartySize,
      bookingsCloseAt: data.bookingsCloseAt === null ? null : new Date(data.bookingsCloseAt),
      status: data.status,
      updatedBy: context.user.id,
      updatedAt: new Date(),
    };

    let id = data.id;
    if (id) {
      const current = await db.query.events.findFirst({ where: eq(events.id, id) });
      if (!current) throw new Error('That event no longer exists.');
      if (current.status === 'cancelled') {
        throw new Error('This event is cancelled and can no longer be changed.');
      }
      const [row] = await db
        .select({ taken: sql<number>`coalesce(sum(${eventBookings.partySize}), 0)` })
        .from(eventBookings)
        .where(and(eq(eventBookings.eventId, id), confirmed));
      const problem = capacityProblem(data.capacity, Number(row?.taken ?? 0));
      if (problem) throw new Error(problem);
      // A new start time earns a fresh reminder.
      const moved = current.startsAt.getTime() !== data.startsAt;
      await db.batch([
        db
          .update(events)
          .set({ ...values, ...(moved ? { reminderSentAt: null } : {}) })
          .where(eq(events.id, id)),
        logActivity(db, {
          actorId: context.user.id,
          actorName: context.user.name,
          action: 'event.saved',
          summary: `Updated the event ${data.title}`,
        }),
      ]);
    } else {
      const [created] = await db
        .insert(events)
        .values({ ...values, createdBy: context.user.id })
        .returning({ id: events.id });
      id = created!.id;
      await logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.saved',
        summary: `Created the event ${data.title}`,
      });
    }
    return { id };
  });

export const cancelEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!event) throw new Error('That event no longer exists.');
    if (event.status === 'cancelled') return { notified: 0 };
    const now = new Date();
    await db.batch([
      db
        .update(events)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now, updatedBy: context.user.id })
        .where(eq(events.id, event.id)),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.cancelled',
        summary: `Cancelled the event ${event.title}`,
      }),
    ]);
    // Task 5 emails the guests here and returns how many were told.
    return { notified: 0 };
  });

export const deleteEvent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.id) });
    if (!event) return;
    // Bookings cascade with it: guest details go with the event.
    await db.batch([
      db.delete(events).where(eq(events.id, event.id)),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.deleted',
        summary: `Deleted the event ${event.title}`,
      }),
    ]);
  });
```

- [ ] **Step 2: Type-check and lint**

Run: `bun run --filter @ll/cms type-check && bun run --filter @ll/cms lint`
Expected: exit 0. If `db.query.events` is missing, the schema export in Task 2 is not in `@ll/db/schema`'s relational schema; check `apps/cms/src/lib/db.ts` passes the whole schema.

- [ ] **Step 3: Commit**

```bash
bunx prettier --write apps/cms/src/server/events.ts
git add apps/cms/src/server/events.ts
git commit -m "feat(cms): server functions to list, save, cancel and delete events"
```

---

### Task 4: Guest list server functions with a race-safe insert

**Files:**

- Create: `apps/cms/src/server/booking-store.ts`
- Create: `apps/cms/src/server/event-guests.ts`

**Interfaces:**

- Consumes: `bookingProblem`, `bookingReference`, `seatsTaken`, `guestInputSchema`, `normaliseEmail` (`@ll/content`); `events`, `eventBookings`.
- Produces:
  - `insertBooking(db: Db, b: NewBooking, capacity: number | null): Promise<{ id: string; reference: string } | null>` (null = not enough places), where `NewBooking = { eventId; firstName; lastName: string|null; email: string|null; phone: string|null; partySize: number; note: string|null; source: 'website'|'staff'; consentAt: Date|null }`
  - `getGuests({ eventId })` → `Guest[]`, `Guest = { id; reference; firstName; lastName: string; email: string; phone: string; partySize: number; note: string; status: 'confirmed'|'cancelled'; source: 'website'|'staff'; checkedInAt: number|null; createdAt: number }`
  - `addGuest(GuestInput)` → `{ reference: string; emailed: boolean }`
  - `cancelGuest({ id })` → `void`
  - `setCheckedIn({ id, checkedIn: boolean })` → `{ checkedInAt: number | null }`

- [ ] **Step 1: The conditional insert**

`apps/cms/src/server/booking-store.ts`:

```ts
import { bookingReference } from '@ll/content';
import type { Db } from '@ll/db';
import { sql } from 'drizzle-orm';

export type NewBooking = {
  eventId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  partySize: number;
  note: string | null;
  source: 'website' | 'staff';
  consentAt: Date | null;
};

/**
 * Writes a confirmed booking only if the event still has room, in one
 * statement, so two bookings for the last places cannot both succeed.
 * Returns null when there was no room. A clashing reference (unique index)
 * is retried with a new one.
 */
export async function insertBooking(
  db: Db,
  b: NewBooking,
  capacity: number | null
): Promise<{ id: string; reference: string } | null> {
  for (let attempt = 0; ; attempt++) {
    const id = crypto.randomUUID();
    const reference = bookingReference(crypto.getRandomValues(new Uint8Array(6)));
    try {
      const result = await db.run(sql`
        INSERT INTO event_bookings
          (id, event_id, reference, first_name, last_name, email, phone, party_size, note,
           status, source, consent_at, created_at)
        SELECT ${id}, ${b.eventId}, ${reference}, ${b.firstName}, ${b.lastName}, ${b.email},
          ${b.phone}, ${b.partySize}, ${b.note}, 'confirmed', ${b.source},
          ${b.consentAt?.getTime() ?? null}, ${Date.now()}
        WHERE ${capacity} IS NULL OR (
          SELECT coalesce(sum(party_size), 0) FROM event_bookings
          WHERE event_id = ${b.eventId} AND status = 'confirmed'
        ) + ${b.partySize} <= ${capacity}`);
      return result.meta.changes === 1 ? { id, reference } : null;
    } catch (error) {
      if (attempt < 3 && String(error).includes('event_bookings.reference')) continue;
      throw error;
    }
  }
}
```

- [ ] **Step 2: Guest server functions**

`apps/cms/src/server/event-guests.ts`:

```ts
import { bookingProblem, guestInputSchema, normaliseEmail, seatsTaken } from '@ll/content';
import { eventBookings, events } from '@ll/db/schema';
import { createServerFn } from '@tanstack/react-start';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { logActivity } from './activity-log';
import { insertBooking } from './booking-store';

export const getGuests = createServerFn({ method: 'GET' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ eventId: z.string() }))
  .handler(async ({ data }) => {
    const rows = await getDb()
      .select()
      .from(eventBookings)
      .where(eq(eventBookings.eventId, data.eventId))
      .orderBy(asc(eventBookings.firstName), asc(eventBookings.lastName));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      firstName: r.firstName,
      lastName: r.lastName ?? '',
      email: r.email ?? '',
      phone: r.phone ?? '',
      partySize: r.partySize,
      note: r.note ?? '',
      status: r.status,
      source: r.source,
      checkedInAt: r.checkedInAt?.getTime() ?? null,
      createdAt: r.createdAt.getTime(),
    }));
  });

export type Guest = Awaited<ReturnType<typeof getGuests>>[number];

export const addGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(guestInputSchema)
  .handler(async ({ data, context }) => {
    const db = getDb();
    const event = await db.query.events.findFirst({ where: eq(events.id, data.eventId) });
    if (!event) throw new Error('That event no longer exists.');
    const bookings = await db
      .select({ status: eventBookings.status, partySize: eventBookings.partySize })
      .from(eventBookings)
      .where(eq(eventBookings.eventId, event.id));
    const problem = bookingProblem(
      {
        status: event.status,
        startsAt: event.startsAt.getTime(),
        endsAt: event.endsAt.getTime(),
        bookingsCloseAt: event.bookingsCloseAt?.getTime() ?? null,
        capacity: event.capacity,
        maxPartySize: event.maxPartySize,
      },
      data.partySize,
      seatsTaken(bookings),
      Date.now(),
      'staff'
    );
    if (problem) throw new Error(problem);

    const booking = await insertBooking(
      db,
      {
        eventId: event.id,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email ? normaliseEmail(data.email) : null,
        phone: data.phone || null,
        partySize: data.partySize,
        note: data.note || null,
        source: 'staff',
        consentAt: null,
      },
      event.capacity
    );
    if (!booking) throw new Error('This event is fully booked.');

    await logActivity(db, {
      actorId: context.user.id,
      actorName: context.user.name,
      action: 'event.guest_added',
      summary: `Added ${data.firstName} (${data.partySize}) to ${event.title}`,
    });
    // Task 5 sends the confirmation when asked and reports it here.
    return { reference: booking.reference, emailed: false };
  });

export const cancelGuest = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const booking = await db.query.eventBookings.findFirst({
      where: eq(eventBookings.id, data.id),
    });
    if (!booking || booking.status === 'cancelled') return;
    await db.batch([
      db
        .update(eventBookings)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(eventBookings.id, booking.id)),
      logActivity(db, {
        actorId: context.user.id,
        actorName: context.user.name,
        action: 'event.guest_cancelled',
        summary: `Cancelled the booking ${booking.reference}`,
      }),
    ]);
  });

export const setCheckedIn = createServerFn({ method: 'POST' })
  .middleware([requirePermission('events:manage')])
  .validator(z.object({ id: z.string(), checkedIn: z.boolean() }))
  .handler(async ({ data, context }) => {
    const at = data.checkedIn ? new Date() : null;
    await getDb()
      .update(eventBookings)
      .set({ checkedInAt: at, checkedInBy: data.checkedIn ? context.user.id : null })
      .where(eq(eventBookings.id, data.id));
    return { checkedInAt: at?.getTime() ?? null };
  });
```

- [ ] **Step 3: Type-check and lint**

Run: `bun run --filter @ll/cms type-check && bun run --filter @ll/cms lint`
Expected: exit 0. If `result.meta` is not typed, `db.run` returns `D1Result`; import `type D1Result` is not needed, read `result.meta.changes` as typed by drizzle-orm/d1.

- [ ] **Step 4: Commit**

```bash
bunx prettier --write apps/cms/src/server/booking-store.ts apps/cms/src/server/event-guests.ts
git add apps/cms/src/server/booking-store.ts apps/cms/src/server/event-guests.ts
git commit -m "feat(cms): guest list server functions with a race-safe booking insert"
```

(The race check in Review Focus 1 runs in Task 8, once there is UI to sign in with.)

---

### Task 5: Event emails

**Files:**

- Modify: `apps/cms/src/lib/email.ts` (sender, reply-to, attachments, optional button, three templates)
- Create: `apps/cms/src/server/event-mail.ts`
- Modify: `apps/cms/src/server/events.ts` (`cancelEvent` emails guests)
- Modify: `apps/cms/src/server/event-guests.ts` (`addGuest` sends the confirmation)
- Modify: `apps/cms/wrangler.jsonc` (`EVENTS_EMAIL_FROM`), `apps/cms/worker-configuration.d.ts` (regenerated)

**Interfaces:**

- Consumes: `eventIcs` (`@ll/content`); `formatDateTime`, `zoneName` (`@/lib/format`); `readSiteSettings`.
- Produces:
  - `email.ts`: `sendBookingConfirmation(to, d: BookingMail & { ics: string })`, `sendEventReminder(to, d: BookingMail)`, `sendEventCancelled(to, d: Omit<BookingMail, 'reference' | 'partySize'>)`, where `BookingMail = { firstName: string; title: string; when: string; venue: string; mapUrl: string | null; partySize: number; reference: string; replyTo: string }`
  - `event-mail.ts`: `mailDetails(db, eventId)` → `{ event, when, venue, mapUrl, replyTo } | null`; `emailConfirmation(db, booking)`; `emailReminder(db, booking)`; `emailCancellation(db, eventId)` → number sent

- [ ] **Step 1: Extend `send` and the layout**

In `apps/cms/src/lib/email.ts`:

Replace the `Email` type with:

```ts
type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Defaults to EMAIL_FROM (the CMS sender). */
  from?: string;
  replyTo?: string;
  /** Base64 content, e.g. an .ics file. */
  attachments?: { filename: string; content: string }[];
};
```

Replace the `body: JSON.stringify(...)` line in `send` with:

```ts
    body: JSON.stringify({
      from: email.from ?? env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.attachments ? { attachments: email.attachments } : {}),
    }),
```

In `layout(opts)`, make `button` optional (`button?: { label: string; url: string };`), compute `const url = opts.button ? escapeHtml(opts.button.url) : '';`, and wrap the button's table markup in `${opts.button ? \`…existing button markup…\` : ''}` so emails without an action render no button.

Append the templates:

```ts
type BookingMail = {
  firstName: string;
  title: string;
  /** Already formatted in the site time zone, e.g. "Sat 7 Nov 2026, 10:00 am AEDT". */
  when: string;
  venue: string;
  mapUrl: string | null;
  partySize: number;
  reference: string;
  replyTo: string;
};

const eventsFrom = () => env.EVENTS_EMAIL_FROM ?? env.EMAIL_FROM;
const places = (n: number) => (n === 1 ? '1 place' : `${n} places`);
const detailRows = (d: Pick<BookingMail, 'when' | 'venue'>) =>
  [`<strong style="color:${colours.ink};">When:</strong> ${escapeHtml(d.when)}`].concat(
    d.venue ? [`<strong style="color:${colours.ink};">Where:</strong> ${escapeHtml(d.venue)}`] : []
  );

export async function sendBookingConfirmation(
  to: string,
  d: BookingMail & { ics: string }
): Promise<void> {
  const subject = `You're booked: ${d.title}`;
  const text = [
    `Hi ${d.firstName},`,
    '',
    `You're booked for ${d.title}: ${places(d.partySize)}.`,
    `When: ${d.when}`,
    ...(d.venue ? [`Where: ${d.venue}`] : []),
    `Booking reference: ${d.reference}`,
    '',
    'The calendar file attached adds it to your calendar.',
    'Need to cancel or change your booking? Reply to this email and we will sort it out.',
    ...textFooter,
  ].join('\n');
  const html = layout({
    preheader: `Booking ${d.reference} for ${d.title}.`,
    heading: `You're booked, ${escapeHtml(d.firstName)}`,
    intro: [
      `We look forward to seeing you at <strong style="color:${colours.ink};">${escapeHtml(d.title)}</strong>. Your booking is for ${places(d.partySize)}.`,
      ...detailRows(d),
      `<strong style="color:${colours.ink};">Booking reference:</strong> ${escapeHtml(d.reference)}`,
    ],
    button: d.mapUrl ? { label: 'Get directions', url: d.mapUrl } : undefined,
    note: 'The calendar file attached adds the event to your calendar. Need to cancel or change your booking? Reply to this email and we will sort it out.',
  });
  await send({
    to,
    subject,
    html,
    text,
    from: eventsFrom(),
    replyTo: d.replyTo,
    // nodejs_compat is on, so Buffer is available for the base64 Resend wants.
    attachments: [{ filename: 'event.ics', content: Buffer.from(d.ics).toString('base64') }],
  });
}

export async function sendEventReminder(to: string, d: BookingMail): Promise<void> {
  const subject = `Tomorrow: ${d.title}`;
  const text = [
    `Hi ${d.firstName},`,
    '',
    `A reminder that ${d.title} is coming up. Your booking is for ${places(d.partySize)}.`,
    `When: ${d.when}`,
    ...(d.venue ? [`Where: ${d.venue}`] : []),
    `Booking reference: ${d.reference}`,
    '',
    "Can't make it? Reply to this email so we can offer your place to someone else.",
    ...textFooter,
  ].join('\n');
  const html = layout({
    preheader: `${d.title} is coming up.`,
    heading: 'See you soon',
    intro: [
      `A reminder that <strong style="color:${colours.ink};">${escapeHtml(d.title)}</strong> is coming up. Your booking is for ${places(d.partySize)}.`,
      ...detailRows(d),
      `<strong style="color:${colours.ink};">Booking reference:</strong> ${escapeHtml(d.reference)}`,
    ],
    button: d.mapUrl ? { label: 'Get directions', url: d.mapUrl } : undefined,
    note: "Can't make it? Reply to this email so we can offer your place to someone else.",
  });
  await send({ to, subject, html, text, from: eventsFrom(), replyTo: d.replyTo });
}

export async function sendEventCancelled(
  to: string,
  d: Omit<BookingMail, 'reference' | 'partySize'>
): Promise<void> {
  const subject = `Cancelled: ${d.title}`;
  const text = [
    `Hi ${d.firstName},`,
    '',
    `We're sorry, but ${d.title} on ${d.when} has been cancelled, so your booking no longer stands.`,
    'Reply to this email if you have any questions.',
    ...textFooter,
  ].join('\n');
  const html = layout({
    preheader: `${d.title} has been cancelled.`,
    heading: 'This event has been cancelled',
    intro: [
      `Hi ${escapeHtml(d.firstName)}, we're sorry, but <strong style="color:${colours.ink};">${escapeHtml(d.title)}</strong> on ${escapeHtml(d.when)} has been cancelled, so your booking no longer stands.`,
      'Reply to this email if you have any questions.',
    ],
  });
  await send({ to, subject, html, text, from: eventsFrom(), replyTo: d.replyTo });
}
```

`apps/cms/wrangler.jsonc` `vars`: add after `EMAIL_FROM`:

```jsonc
    // Sender for guest emails about events (bookings, reminders, cancellations).
    "EVENTS_EMAIL_FROM": "Living Legacy <events@notify.livinglegacy.com.au>"
```

Run: `cd apps/cms && bunx wrangler types --env-interface=CloudflareEnv` (regenerates `worker-configuration.d.ts` with `EVENTS_EMAIL_FROM`).

- [ ] **Step 2: Event mail helpers**

`apps/cms/src/server/event-mail.ts`:

```ts
import { eventIcs } from '@ll/content';
import type { Db } from '@ll/db';
import { eventBookings, events, locations } from '@ll/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { sendBookingConfirmation, sendEventCancelled, sendEventReminder } from '@/lib/email';
import { formatDateTime, zoneName } from '@/lib/format';
import { readSiteSettings } from '@/lib/site-settings';

type BookingRow = typeof eventBookings.$inferSelect;

/** What every guest email needs about the event, formatted in the site time zone. */
export async function mailDetails(db: Db, eventId: string) {
  const [row] = await db
    .select({ event: events, location: locations })
    .from(events)
    .leftJoin(locations, eq(events.locationId, locations.id))
    .where(eq(events.id, eventId));
  if (!row) return null;
  const settings = await readSiteSettings();
  const { event, location } = row;
  return {
    event,
    when: `${formatDateTime(event.startsAt.getTime(), settings.timeZone)} ${zoneName(event.startsAt.getTime(), settings.timeZone)}`,
    venue: event.venue ?? location?.address ?? '',
    mapUrl: location?.mapUrl ?? null,
    replyTo: location?.email || settings.contactEmail,
  };
}

/** Best effort: a failed email is logged and never undoes the booking. */
export async function emailConfirmation(db: Db, booking: BookingRow): Promise<boolean> {
  if (!booking.email) return false;
  const d = await mailDetails(db, booking.eventId);
  if (!d) return false;
  try {
    await sendBookingConfirmation(booking.email, {
      firstName: booking.firstName,
      title: d.event.title,
      when: d.when,
      venue: d.venue,
      mapUrl: d.mapUrl,
      partySize: booking.partySize,
      reference: booking.reference,
      replyTo: d.replyTo,
      ics: eventIcs({
        uid: `${booking.reference}@livinglegacy.com.au`,
        title: d.event.title,
        startsAt: d.event.startsAt.getTime(),
        endsAt: d.event.endsAt.getTime(),
        location: d.venue,
        description: d.event.summary ?? '',
        now: Date.now(),
      }),
    });
    return true;
  } catch (error) {
    console.error('[events] confirmation email failed', booking.reference, error);
    return false;
  }
}

export async function emailReminder(
  db: Db,
  booking: BookingRow,
  details?: Awaited<ReturnType<typeof mailDetails>>
): Promise<boolean> {
  if (!booking.email) return false;
  const d = details ?? (await mailDetails(db, booking.eventId));
  if (!d) return false;
  try {
    await sendEventReminder(booking.email, {
      firstName: booking.firstName,
      title: d.event.title,
      when: d.when,
      venue: d.venue,
      mapUrl: d.mapUrl,
      partySize: booking.partySize,
      reference: booking.reference,
      replyTo: d.replyTo,
    });
    return true;
  } catch (error) {
    console.error('[events] reminder email failed', booking.reference, error);
    return false;
  }
}

/** Tells every confirmed guest with an email; returns how many were sent. */
export async function emailCancellation(db: Db, eventId: string): Promise<number> {
  const d = await mailDetails(db, eventId);
  if (!d) return 0;
  const guests = await db
    .select()
    .from(eventBookings)
    .where(
      and(
        eq(eventBookings.eventId, eventId),
        eq(eventBookings.status, 'confirmed'),
        isNotNull(eventBookings.email)
      )
    );
  let sent = 0;
  for (const g of guests) {
    try {
      await sendEventCancelled(g.email!, {
        firstName: g.firstName,
        title: d.event.title,
        when: d.when,
        venue: d.venue,
        mapUrl: d.mapUrl,
        replyTo: d.replyTo,
      });
      sent++;
    } catch (error) {
      console.error('[events] cancellation email failed', g.reference, error);
    }
  }
  return sent;
}
```

Check `zoneName`'s signature in `apps/cms/src/lib/format.ts` before relying on it; if it takes only the zone, call `zoneName(settings.timeZone)`.

- [ ] **Step 3: Wire the emails in**

In `apps/cms/src/server/events.ts` `cancelEvent`, replace `// Task 5 emails…` and its `return` with:

```ts
return { notified: await emailCancellation(db, event.id) };
```

and import `emailCancellation` from `./event-mail`.

In `apps/cms/src/server/event-guests.ts` `addGuest`, replace `// Task 5 sends…` and its `return` with:

```ts
let emailed = false;
if (data.sendConfirmation && data.email) {
  const row = await db.query.eventBookings.findFirst({
    where: eq(eventBookings.id, booking.id),
  });
  if (row) emailed = await emailConfirmation(db, row);
}
return { reference: booking.reference, emailed };
```

and import `emailConfirmation` from `./event-mail`.

- [ ] **Step 4: Type-check, lint, test**

Run: `bun run type-check && bun run lint && bun run test`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write apps/cms/src apps/cms/wrangler.jsonc
git add apps/cms
git commit -m "feat(cms): booking confirmation, reminder and cancellation emails"
```

---

### Task 6: Scheduled jobs and the HubSpot hook

**Files:**

- Create: `apps/cms/src/server/event-jobs.ts`
- Create: `apps/cms/src/server/event-crm.ts`
- Modify: `apps/cms/src/server.ts` (cron wiring)
- Modify: `apps/cms/src/env.d.ts` (`HUBSPOT_ACCESS_TOKEN?`)

**Interfaces:**

- Consumes: `emailReminder`, `mailDetails` (Task 5); `BOOKING_RETENTION_DAYS` (Task 1).
- Produces: `sendDueReminders(d1: D1Database, now: Date)`, `purgeOldBookings(d1: D1Database, now: Date)`, `syncPending(d1: D1Database)`.

- [ ] **Step 1: Jobs**

`apps/cms/src/server/event-jobs.ts`:

```ts
import { BOOKING_RETENTION_DAYS } from '@ll/content';
import { createDb } from '@ll/db';
import { eventBookings, events } from '@ll/db/schema';
import { and, eq, gt, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { emailReminder, mailDetails } from './event-mail';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reminds guests about 24 hours ahead. Each event is claimed by setting
 * reminder_sent_at only where it is still null, so a second run of the cron
 * finds nothing to send.
 */
export async function sendDueReminders(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const due = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.status, 'published'),
        isNull(events.reminderSentAt),
        gt(events.startsAt, now),
        lte(events.startsAt, new Date(now.getTime() + DAY_MS))
      )
    );
  for (const { id } of due) {
    const claimed = await db
      .update(events)
      .set({ reminderSentAt: now })
      .where(and(eq(events.id, id), isNull(events.reminderSentAt)))
      .returning({ id: events.id });
    if (claimed.length === 0) continue;
    const details = await mailDetails(db, id);
    const guests = await db
      .select()
      .from(eventBookings)
      .where(
        and(
          eq(eventBookings.eventId, id),
          eq(eventBookings.status, 'confirmed'),
          isNotNull(eventBookings.email)
        )
      );
    for (const g of guests) await emailReminder(db, g, details);
  }
}

/** Guest details go a year after the event ends; the event row stays. */
export async function purgeOldBookings(d1: D1Database, now: Date) {
  const db = createDb(d1);
  const cutoff = new Date(now.getTime() - BOOKING_RETENTION_DAYS * DAY_MS);
  const old = db.select({ id: events.id }).from(events).where(lte(events.endsAt, cutoff));
  await db.delete(eventBookings).where(inArray(eventBookings.eventId, old));
}
```

`apps/cms/src/server/event-crm.ts`:

```ts
import { env } from 'cloudflare:workers';

/**
 * HubSpot, once it is connected. Every booking has crm_synced_at (null until
 * sent), crm_contact_id and crm_error, so turning this on later sends every
 * booking made so far and then each new one, with no schema change.
 *
 * To build it: select bookings where crm_synced_at is null and email is not
 * null; upsert the HubSpot contact by email; record the event (a property or
 * a note); set crm_synced_at and crm_contact_id, or crm_error on failure.
 */
export async function syncPending(_d1: D1Database): Promise<void> {
  if (!env.HUBSPOT_ACCESS_TOKEN) return;
  console.warn('[events] HUBSPOT_ACCESS_TOKEN is set, but HubSpot sync is not built yet.');
}
```

`apps/cms/src/env.d.ts` inside `interface Env`:

```ts
    // HubSpot private app token; event bookings sync once it is set (server/event-crm.ts).
    HUBSPOT_ACCESS_TOKEN?: string;
```

- [ ] **Step 2: Wire the crons**

In `apps/cms/src/server.ts` `scheduled`, replace the body with:

```ts
const now = new Date(controller.scheduledTime);
if (controller.cron === MEDIA_SWEEP_CRON) {
  const [{ sweepOrphanedMedia }, { purgeOldBookings }] = await Promise.all([
    import('./server/media-sweep'),
    import('./server/event-jobs'),
  ]);
  ctx.waitUntil(
    Promise.all([sweepOrphanedMedia(env.DB, env.MEDIA, now), purgeOldBookings(env.DB, now)])
  );
  return;
}
const [{ publishDuePosts }, { sendDueReminders }, { syncPending }] = await Promise.all([
  import('./server/scheduler'),
  import('./server/event-jobs'),
  import('./server/event-crm'),
]);
ctx.waitUntil(
  Promise.all([publishDuePosts(env.DB, now), sendDueReminders(env.DB, now), syncPending(env.DB)])
);
```

Update the comment above `MEDIA_SWEEP_CRON`/the entry to mention reminders and the booking clean-up.

- [ ] **Step 3: Type-check, lint, startup check**

Run:

```bash
bun run type-check && bun run lint
cd apps/cms && bunx wrangler check startup 2>&1 | tail -3
```

Expected: exit 0; startup time in the same range as before (under 25ms), since the jobs are dynamic imports.

- [ ] **Step 4: Commit**

```bash
bunx prettier --write apps/cms/src
git add apps/cms/src
git commit -m "feat(cms): event reminders, booking clean-up and a dormant HubSpot sync"
```

---

### Task 7: Events page in the CMS

**Files:**

- Create: `apps/cms/src/routes/_app/events/index.tsx`
- Create: `apps/cms/src/components/events/events-page.tsx`
- Create: `apps/cms/src/components/events/event-form.tsx`
- Modify: `apps/cms/src/lib/nav.ts` (`/events` route and item)

**Interfaces:**

- Consumes: `listEvents`, `saveEvent`, `cancelEvent`, `deleteEvent`, `EventsData`, `EventRow`, `LocationOption` (Task 3); list building blocks from `@/components/list/*` (see `apps/cms/src/components/terms/terms-page.tsx`, the smallest list page, for their use).
- Produces: `EventsPage({ data })`; `EventForm({ event, locations, onSaved, footer })`; the pane slot `guests` that Task 8 fills (`EventGuests` is imported in Task 8, rendered in the pane when the "Guests" view is chosen).

- [ ] **Step 1: Route and nav**

`apps/cms/src/routes/_app/events/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { EventsPage } from '@/components/events/events-page';
import { listEvents } from '@/server/events';

export const Route = createFileRoute('/_app/events/')({
  loader: () => listEvents(),
  head: () => ({ meta: [{ title: 'Events | Living Legacy CMS' }] }),
  component: EventsRoute,
});

function EventsRoute() {
  return <EventsPage data={Route.useLoaderData()} />;
}
```

`apps/cms/src/lib/nav.ts`: add `| '/events'` to `NavItem['to']`, import `CalendarClockIcon` from `@/components/icons`, and add after the Locations item:

```ts
      { title: 'Events', icon: CalendarClockIcon, to: '/events', permission: 'events:manage' },
```

Run `bun run --filter @ll/cms build` once (or start `bun run dev:cms`) so TanStack Router regenerates `routeTree.gen.ts` with `/_app/events/`.

- [ ] **Step 2: The page**

`apps/cms/src/components/events/events-page.tsx` follows `terms-page.tsx`'s structure exactly (`useListPane<Target>`, `ListPageLayout`, `ListColumn` with a `SelectionBar` header, `ListRows` of `ListRow`, `PaneColumn` with `PaneFrame`, `ListDialog` on phones, `ConfirmBulkDelete` for bulk delete). Differences:

- `Target = { kind: 'edit'; id: string } | { kind: 'new' }`; `noun: ['event', 'events']`.
- A `ToggleGroup` filter above the list: `Upcoming` (default: `endsAt >= now` and not draft), `Drafts`, `Past` (`endsAt < now`), `All`. Upcoming sorts soonest first; Past and All latest first.
- Search over `title`, `locationName`, `venue`.
- Each row (`EventSummary`): the date (`formatDate(startsAt, zone)` from `@/lib/format`, with `useTimeZone()`), the title, the location name, and a badge: `Draft` / `Cancelled` (outline) or `{booked} / {capacity ?? '∞'} booked` with `tabular-nums`.
- The pane title is the event title; under it a `ToggleGroup` with `Details` and `Guests` (Guests disabled for a new event). `Details` renders `EventForm`; `Guests` renders `<EventGuests event={event} />` (Task 8; until then render nothing for Guests).
- Bulk delete calls `deleteEvent` per id: `run(async () => { for (const id of ids) await deleteEvent({ data: { id } }); return ids.length; }, { success: (n) => removedNotice(n, NOUN), error: 'Could not remove' })`, with the bulk-delete description "Their guest lists are deleted too. This cannot be undone."
- Empty state: `CalendarClockIcon`, "No events yet", "Create an open day or information session and keep its guest list here."

- [ ] **Step 3: The form**

`apps/cms/src/components/events/event-form.tsx`, props `{ event: EventRow | null; locations: LocationOption[]; onSaved: (id: string | null) => void; footer: (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode }`.

State is one `values` object of `EventInput` shape, initialised from `event` or these defaults: `title ''`, `slug ''`, `locationId null`, `venue ''`, `startsAt null`, `endsAt null`, `summary ''`, `description ''`, `heroMediaId null`, `capacity null`, `maxPartySize 6`, `bookingsCloseAt null`, `status 'draft'`.

Fields, in order, each with a `Label`:

1. Title (`Input`, required, maxLength 120).
2. Web address (`Input`, placeholder `slugify(title)`, `font-mono`; hint "Used for its page once the website shows events.").
3. Location (`Select` with items `[{ value: '', label: 'No location' }, ...locations]`); picking one fills Venue with its address when Venue is empty.
4. Venue (`Input`, placeholder: the chosen location's address).
5. Starts and Ends (`DateTimePicker` from `@/components/date-time-picker`, side by side on `sm`); when Starts is set and Ends is empty, set Ends to Starts + 2 hours.
6. Capacity (`Input type="number" min=1`, blank means no limit; hint "Total people. Leave empty for no limit.") and Max per booking (`Input type="number" min=1 max=50`), side by side.
7. Bookings close (`DateTimePicker`, optional; hint "Online bookings close at the start unless set.").
8. Summary (`Textarea rows=2`, maxLength 200; hint "A sentence for lists and emails.").
9. Description (`Textarea rows=6`; hint "Markdown.").
10. Photo (`ImageField` from `@/components/media/image-field`, `id="ev-photo"`, `label="Photo"`).
11. Published (`Switch`; hint "Ready for the website once it shows events.").

Submit: `reportInvalid(e.currentTarget)`; if `startsAt` or `endsAt` is null, `notify.error('Check the event', 'Set when it starts and ends.')` and return; then

```ts
const result = await run(
  () => saveEvent({ data: { ...values, id: event?.id, startsAt, endsAt } }),
  {
    success: {
      title: event ? 'Event saved' : 'Event created',
      description:
        values.status === 'published'
          ? 'Staff can add guests, and it is ready for the website.'
          : 'It is a draft. Staff can still add guests.',
    },
    error: 'Could not save the event',
  }
);
if (result) onSaved(result.id);
```

`start` slot (saved events only): a `Cancel event` button (hidden when already cancelled) opening an `AlertDialog`: title "Cancel {title}?", description "{bookings} {booking|bookings} will be told by email. The event stays in the list, marked cancelled. This cannot be undone.", action runs `cancelEvent` with success `{ title: 'Event cancelled', description: n === 1 ? '1 guest was emailed.' : \`${n} guests were emailed.\` }`(use`notified`), error `'Could not cancel the event'`; and a `Delete`button with`AlertDialog`"Delete {title}?" / "Its guest list is deleted too. This cannot be undone." running`deleteEvent`with`removedNotice(1, ['event','events'])`. A cancelled event shows its fields read-only with a note "This event is cancelled."

- [ ] **Step 4: Check in the browser**

Run `bun run dev:cms` (or use the running dev server). Sign in, open Events:

- create an event at a location, 10:00 to 12:00 next Saturday, capacity 10; it appears under Upcoming with "0 / 10 booked";
- edit it, save; switch filters; search;
- at 390px with touch emulation: the list, the dialog form, and the tab bar's More sheet show Events.

- [ ] **Step 5: Type-check, lint, format, commit**

```bash
bunx prettier --write apps/cms/src
bun run type-check && bun run lint && bun run format:check
git add apps/cms/src
git commit -m "feat(cms): events page with a list, filters and an event form"
```

---

### Task 8: Guest list, check-in and CSV export

**Files:**

- Create: `apps/cms/src/components/events/event-guests.tsx`
- Create: `apps/cms/src/components/events/add-guest-dialog.tsx`
- Modify: `apps/cms/src/components/events/events-page.tsx` (render `EventGuests` for the Guests view)

**Interfaces:**

- Consumes: `getGuests`, `addGuest`, `cancelGuest`, `setCheckedIn`, `Guest` (Task 4); `toCsv` (`@ll/content`); `EventRow` (Task 3).
- Produces: `EventGuests({ event }: { event: EventRow })`, `AddGuestDialog({ event, onAdded })`.

- [ ] **Step 1: Guests view**

`event-guests.tsx`:

- Loads with `getGuests({ data: { eventId: event.id } })` in a `useEffect` keyed on `event.id`, into `useState<Guest[] | null>` (null shows `Spinner`). A `reload()` re-fetches; it runs after add and cancel.
- Header: three stats in a row, `tabular-nums`: **Booked** `{booked} of {capacity}` (or `{booked}` with no limit), **Bookings** `{count}`, **Checked in** `{checkedInPeople} of {booked}`. Computed from the confirmed guests.
- Toolbar: `SearchInput` (name, email, phone, reference), `Add guest` button (opens `AddGuestDialog`), `Export CSV` button.
- Rows (confirmed, then a "Cancelled" heading with cancelled rows muted and without controls): name, `party size` badge when over 1, reference in `font-mono text-xs`, note in muted text, and on the right a check-in button, `min-h-11 min-w-28`: unchecked `variant="outline"` "Check in"; checked `variant="secondary"` with `CheckIcon` "Checked in". Tapping updates the row immediately (optimistic), then calls `setCheckedIn`; on failure it reverts and `notify.error('Could not update the check-in', error)`.
- Each confirmed row has a `More` menu (`DropdownMenu`) with "Cancel booking", confirming in an `AlertDialog` "Cancel {name}'s booking?" / "Their places are freed for others. They are not emailed." and running `cancelGuest` with success `{ title: 'Booking cancelled', description: \`${places} freed for others.\` }`, error `'Could not cancel the booking'`, then `reload()`.
- Export: rows `[['Reference','First name','Last name','Email','Phone','Party size','Note','Status','Checked in','Booked at'], ...]` (times via `formatDateTime(…, zone)`), `toCsv(rows)`, download as `guests-{slug}.csv` with a `Blob` and a temporary `<a download>`; `notify.success({ title: 'Guest list exported', description: \`${n} bookings in ${filename}.\` })`.
- Phones: the view fills the dialog; rows are at least 44pt; the stats wrap.

- [ ] **Step 2: Add guest dialog**

`add-guest-dialog.tsx`: a `Dialog` with First name (required), Last name, Email, Phone, Party size (`type="number"`, default 1), Note, and a `Checkbox` "Email them a confirmation" (checked by default once an email is typed; disabled with no email). Submit:

```ts
const result = await run(() => addGuest({ data: { eventId: event.id, ...values } }), {
  success: (r) => ({
    title: 'Guest added',
    description: r.emailed
      ? `Booking ${r.reference}. A confirmation is on its way.`
      : `Booking ${r.reference}.`,
  }),
  error: 'Could not add the guest',
});
if (result) {
  onAdded();
  close();
}
```

- [ ] **Step 3: Render it in the pane**

In `events-page.tsx`, render `<EventGuests event={editing(pane)!} />` when the Guests view is chosen, in both the pane and the phone dialog.

- [ ] **Step 4: Browser checks (Review Focus 1 and 5)**

With the dev server and an event of capacity 10:

- add a guest with no email: the confirmation box is disabled; the row shows; CSV includes them with an empty email;
- add a guest with an email and the box ticked (local dev logs the email instead of sending): toast says a confirmation is on its way; the dev server log shows the email text with the reference;
- check a guest in and out at 390px touch: the button is at least 44pt and updates at once;
- cancel a booking: counts drop;
- race: set capacity to the people booked + 2, open the event's Guests view in two tabs, fill "Add guest" for 2 people in both, and submit both within a second. Expected: one "Guest added", one "This event is fully booked."; the count never exceeds capacity. (`bookingProblem` passes for both; the conditional insert in `insertBooking` is what refuses the second.)
- Lower the capacity below the people booked and save: refused with "N people are already booked. Set the capacity to at least N." (Review Focus 2).

- [ ] **Step 5: Type-check, lint, format, commit**

```bash
bunx prettier --write apps/cms/src
bun run type-check && bun run lint && bun run format:check
git add apps/cms/src
git commit -m "feat(cms): guest list with check-in, add guest and CSV export"
```

---

### Task 9: Emails and cron, end to end; then the PR

**Files:**

- Modify: `AGENTS.md` (list pages line: add events), `README.md` (one line on `EVENTS_EMAIL_FROM` if env vars are listed there)

- [ ] **Step 1: Time zone and .ics (Review Focus 3)**

With the site time zone Melbourne, create an event at 10:00 next Saturday, add a guest with an email and confirmation ticked. In the dev server log, the email text shows "10:00 am" with the zone name; decode the attachment line or call `eventIcs` with the stored times in a quick `bun -e` and confirm `DTSTART` is 23:00Z the day before.

- [ ] **Step 2: Reminder runs once (Review Focus 4)**

Move that event's start to 20 hours from now and publish it. Trigger the cron twice locally:

```bash
cd apps/cms
curl -s "http://localhost:3100/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
curl -s "http://localhost:3100/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

(If the Vite dev server does not expose the scheduled handler, run `bunx wrangler dev --test-scheduled` in `apps/cms` against the build, and use port 8787.) Expected: the log shows one reminder per guest, not two; `reminder_sent_at` is set (`bunx wrangler d1 execute DB --local --command "select reminder_sent_at from events"`).

- [ ] **Step 3: Full checks**

Run: `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build`
Expected: all exit 0.

- [ ] **Step 4: Docs and commit**

Add events to the list of list pages in `AGENTS.md` ("Team, FAQs, redirects, testimonials, media coverage, announcements, terms, posts and events share `components/list/`").

```bash
bunx prettier --write AGENTS.md README.md
git add AGENTS.md README.md
git commit -m "docs: events in the list page notes"
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin feat/event-ticketing
gh pr create --base master --title "feat(cms): events with guest lists, check-in and booking emails" \
  --body "Phase 1 of docs/superpowers/specs/2026-11-06-event-ticketing-design.md: events, guest lists, check-in, CSV export, confirmation/reminder/cancellation emails, booking clean-up and a dormant HubSpot sync. CMS only; the website pages come in phase 2. Checked: the Review Focus list in the plan."
```

After merge: run `bun run --filter @ll/cms db:migrate:remote` before or with the deploy (the Deploy CMS workflow may already apply migrations; check `.github/workflows` first).

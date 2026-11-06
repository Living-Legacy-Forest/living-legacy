# Event bookings (free open days): design spec

Date: 2026-11-06
Status: approved in chat; spec awaiting review

## 1. Goal

Replace Eventbrite for free open days and information sessions. People book a
place on the website and get a confirmation with a booking reference. Staff
manage the guest list in the CMS and check people in on a phone.

**Success criteria**

- A visitor books a place in under a minute and gets a confirmation email with
  an add-to-calendar file and a link to cancel.
- An event never takes more people than its capacity, even with bookings made
  at the same moment.
- On the day, a staff member finds a guest by name and checks them in with one
  tap on a phone.
- Every booking can be sent to HubSpot later without re-collecting anything
  (section 7).

## 2. Scope

**In v1**

- Events in the CMS: create, edit, publish, cancel, delete.
- Booking on the website: an events list and a page per event with a form.
- Capacity (total people) and a maximum party size per booking.
- Guest list per event: search, counts, tap to check in, add a guest by hand,
  cancel a booking, CSV export.
- Emails: confirmation (with .ics and cancel link), reminder the day before,
  notice when an event is cancelled.
- Guests cancel their own booking from the email link.
- Booking data deleted 12 months after the event.
- A GA4 lead event for each booking.

**Not in v1**

- Paid tickets, waitlists, QR codes, recurring events, tour time slots.
- Syncing to HubSpot (designed for, see section 7; HubSpot is not connected yet).
- Places held back from online booking (staff raise the capacity instead).
- Emailing all guests of an event from the CMS.

## 3. Data

Two tables in `packages/db/src/schema/events.ts`, added by a new migration.

**`events`**

| Column | Notes |
| --- | --- |
| `id`, lifecycle columns | As other content tables (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`). |
| `title` | Required. |
| `slug` | Unique among live rows; the page is `/events/{slug}/`. |
| `location_id` | Optional FK to `locations` (set null on delete). |
| `venue` | Free text; defaults in the form to the location's address. |
| `starts_at`, `ends_at` | Timestamps. Shown in the site time zone (Settings). |
| `summary` | A sentence for the list and the email. |
| `description` | Rich text, as posts use. |
| `hero_media_id` | Optional FK to `media`. |
| `capacity` | Total people; null means no limit. |
| `max_party_size` | Default 6, at least 1. |
| `bookings_close_at` | Optional; bookings otherwise close when the event starts. |
| `status` | `draft`, `published` or `cancelled`. |
| `reminder_sent_at` | Set when the day-before reminders go out, so they send once. |

**`event_bookings`**

| Column | Notes |
| --- | --- |
| `id` | |
| `event_id` | FK to `events`, cascade on delete. |
| `reference` | Short, unique, readable: `LL-` plus 6 characters without look-alikes (no 0/O, 1/I/L). |
| `first_name`, `last_name`, `email`, `phone` | Email normalised; phone optional. |
| `party_size` | 1 to the event's `max_party_size`. |
| `note` | Optional: accessibility or dietary. |
| `status` | `confirmed` or `cancelled`. |
| `source` | `website` or `staff` (added by hand in the CMS). |
| `manage_token_hash` | Hash of the token in the cancel link; the token itself is never stored. |
| `consent_at` | When the privacy tick was given. |
| `checked_in_at`, `checked_in_by` | Null until checked in. |
| `crm_synced_at`, `crm_contact_id`, `crm_error` | For HubSpot later (section 7). |
| `created_at`, `cancelled_at` | |

Index on `(event_id, status)` for counts, and on `email`.

**Rules** (pure functions in `packages/content/src/events.ts`, unit tested):

- `seatsTaken(bookings)`: sum of `party_size` over confirmed bookings.
- `bookingProblem(event, partySize, now, seatsTaken)`: returns a sentence or
  null. Covers not published, cancelled, started or closed, party size out of
  range, and not enough places left ("Only 3 places are left.").
- `bookingReference(random)`: the `LL-XXXXXX` format.
- `eventIcs(event, booking, siteUrl)`: the calendar file text.
- Zod schemas for the booking form and the event form, shared by both apps.

## 4. Booking flow

1. The website's event page posts the form to an Astro endpoint
   (`/api/events/book`), which validates it and passes it to the CMS over a
   **service binding** (`CMS` → the `living-legacy-cms` Worker). The website
   never holds the email key or the booking rules.
2. The CMS route `POST /internal/events/book` (reachable only through the
   binding: it checks a shared `INTERNAL_KEY` header) runs the rules and writes
   the booking with one conditional insert:
   `INSERT … SELECT … WHERE (seats taken) + party_size <= capacity`. If no row
   is written, the event filled up in the meantime and the visitor is told so.
3. On success it sends the confirmation email and returns the reference. The
   website shows a thank-you page with the reference and fires the GA4
   `generate_lead` event with `form_type: event_rsvp`.
4. The same email booking twice for one event is refused with a message to use
   the link in their first email.
5. A honeypot field and a per-IP limit (5 bookings a minute) slow down bots.

**Cancelling**: the email link opens `/events/manage/?ref=…&token=…` on the
website, which shows the booking and a Cancel button. The CMS checks the token
against its hash, sets the booking to cancelled and frees the places.

## 5. CMS

- **Events** in the sidebar under Content, built on `components/list` like the
  other list pages. Rows show date, title, location and "32 / 50 booked".
  Filters: upcoming, past, drafts.
- **Event pane**: the fields in section 3, a link to the public page, and
  Publish / Cancel event / Delete. Cancelling asks for confirmation, emails the
  guests and keeps the event visible as cancelled on the website until it has
  passed.
- **Guests** (a tab in the event pane, and full screen on phones):
  - counts: booked of capacity, bookings, checked in;
  - search by name, email or reference;
  - each row: name, party size, note, and a large check-in toggle (44pt);
  - add a guest by hand (`source: staff`, no email unless asked);
  - cancel a booking; export CSV.
- **Permission**: a new `events:manage` for admins and editors. Guest details
  are personal information, so authors, SEO and viewers do not see them.
- Writes go in the activity log, as elsewhere.

## 6. Emails and scheduled jobs

Sent by the CMS through the existing Resend setup, from
`Living Legacy <events@notify.livinglegacy.com.au>` (new `EVENTS_EMAIL_FROM`
var), reply-to the location's email or the site contact email.

- **Confirmation**: title, date and time, venue with a map link, party size,
  reference, the `.ics` attached, and the cancel link.
- **Reminder**: the 5-minute cron sends it once, about 24 hours before the
  start, to confirmed bookings, then sets `reminder_sent_at`.
- **Event cancelled**: to every confirmed booking.
- **Clean-up**: the daily cron deletes bookings for events that ended more than
  12 months ago (the event row stays, with its totals in the activity log).

A failed email never undoes a booking; it is logged, and the guest still sees
the reference on the thank-you page.

## 7. Ready for HubSpot

- Every booking keeps `crm_synced_at`, `crm_contact_id` and `crm_error`. Null
  `crm_synced_at` means "not sent yet".
- The CMS has one module, `server/event-crm.ts`, with a `syncBooking(booking)`
  function and a `syncPending()` sweep. In v1 it does nothing unless a
  `HUBSPOT_ACCESS_TOKEN` secret is set, so bookings simply wait.
- Later, filling it in (create or update the contact by email, add the event as
  a property or a note) and calling `syncPending()` from the cron sends every
  booking so far, then new ones as they come. No schema change is needed.

## 8. Website

- `/events/`: upcoming published events, soonest first; cancelled ones marked.
- `/events/{slug}/`: details, places left ("12 places left", "Fully booked"),
  and the booking form, or why booking is closed.
- `/events/manage/`: view and cancel a booking.
- Built with the website's current components and layout; they will be
  restyled with the national design. Not linked from the main navigation until
  then; linked from location pages and campaigns.
- In the sitemap; not indexed while Settings hides the site.

## 9. Testing

- Unit tests for every rule in `packages/content/src/events.ts`, including
  capacity edge cases and the `.ics` output.
- A test of the conditional insert against local D1: two bookings racing for
  the last places, only one succeeds.
- Browser checks: book, cancel from the link, check in on a 390px touch screen,
  CSV export, cancel an event.

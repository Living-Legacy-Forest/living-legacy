# Event bookings (free open days): design spec

Date: 2026-11-06
Status: approved; phase 1 (CMS only) being built

## 1. Goal

Replace Eventbrite for free open days and information sessions. People book a
place on the website and get a booking reference; HubSpot sends their emails. Staff
manage the guest list in the CMS and check people in on a phone.

**Success criteria**

- A visitor books a place in under a minute; HubSpot then sends their emails.
- An event never takes more people than its capacity, even with bookings made
  at the same moment.
- On the day, a staff member finds a guest by name and checks them in with one
  tap on a phone.
- Every booking can be sent to HubSpot later without re-collecting anything
  (section 7).

## 2. Scope

**Phases.** Phase 1 is the CMS only: events, the guest list and check-in,
guests added by staff, clean-up and the HubSpot hook. Phase 2 adds the website
(sections 4 and 8): the public pages and online booking through the service
binding. HubSpot sends every guest email once it is connected.

**In v1**

- Events in the CMS: create, edit, publish, cancel, delete.
- Booking on the website: an events list and a page per event with a form.
- Capacity (total people) and a maximum party size per booking.
- Guest list per event: search, counts, tap to check in, add a guest by hand,
  cancel a booking, CSV export.
- Guest emails are HubSpot's job: the CMS marks every booking and change for
  the HubSpot sync (section 7).
- Guests cancel their own booking from the email link.
- Booking data deleted 12 months after the event.
- A GA4 lead event for each booking.

**Not in v1**

- Paid tickets, waitlists, QR codes, tour time slots.
- Syncing to HubSpot (designed for, see section 7; HubSpot is not connected yet).
- Places held back from online booking (staff raise the capacity instead).
- Emailing all guests of an event from the CMS.

## 3. Data

Two tables in `packages/db/src/schema/events.ts`, added by a new migration.

**`events`**

| Column | Notes |
| --- | --- |
| `id`, lifecycle columns | As other content tables (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`). |
| `series_id` | Links the dates of a repeating event; each date is its own event. |
| `title` | Required. |
| `slug` | Unique among live rows; the page is `/events/{slug}/`. |
| `location_id` | Optional FK to `locations` (set null on delete). |
| `venue` | Free text; defaults in the form to the location's address. |
| `time_zone` | The event's zone: set from its location's state (WA is Perth), changeable. Its times are entered and shown in it. |
| `starts_at`, `ends_at` | Timestamps. |
| `summary` | A sentence for the list and the email. |
| `description` | Rich text (Tiptap JSON), like a post's body. |
| `hero_media_id` | Optional FK to `media`: the cover, the first of its photos. |
| `gallery_media_ids` | JSON list of the rest of its photos, in order (20 photos at most, with the cover). Media refuses to delete an image an event uses. |
| `capacity` | Total people; null means no limit. |
| `max_party_size` | Default 6, at least 1. |
| `bookings_close_at` | Optional; bookings otherwise close when the event starts. |
| `status` | `draft`, `published` or `cancelled`. |

**`event_bookings`**

| Column | Notes |
| --- | --- |
| `id` | |
| `event_id` | FK to `events`, cascade on delete. |
| `reference` | Short, unique, readable: `LL-` plus 6 characters without look-alikes (no 0/O, 1/I/L). |
| `first_name`, `last_name`, `email`, `phone` | Email normalised. Email and phone are optional for guests staff add (walk-ins); the website will require email. Names take letters, spaces, hyphens, apostrophes and full stops. Phones must be an Australian mobile or landline and are stored as `0412 345 678` or `03 7019 6142` (`auPhone`). |
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
3. On success it returns the reference (the booking waits for the HubSpot sync). The
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
  Publish / Cancel event / Delete. Cancelling asks for confirmation, marks the
  bookings for the HubSpot sync (HubSpot tells the guests), and keeps the event
  visible as cancelled on the website until it has passed.
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

**The CMS sends no guest emails.** It keeps the events and bookings; HubSpot
sends confirmations, reminders and cancellation notices from the bookings
synced to it (section 7). (Decided 2026-11-06, replacing CMS-sent emails.)

- **HubSpot sync**: the 5-minute cron calls `syncPending()`.
- **Clean-up**: the daily cron deletes bookings for events that ended more than
  12 months ago (the event row stays).

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
  capacity edge cases.
- A test of the conditional insert against local D1: two bookings racing for
  the last places, only one succeeds.
- Browser checks: book, cancel from the link, check in on a 390px touch screen,
  CSV export, cancel an event.

## 10. Repeating events (added 2026-11-06)

- A new event can repeat: every week or every 2 weeks on one or more weekdays
  (Wednesday and Saturday, say), on dates picked from a calendar, or monthly on the same
  weekday ("2nd Saturday", or "last Saturday" for a 5th), or monthly on the
  same date (months without it are skipped). It ends after a number of dates or
  on a date, never more than 52, and any date can be left out before saving.
- Each date becomes its own event (own capacity, guest list, check-in, CSV and
  HubSpot sync) linked by `series_id`, with its own web address
  (`{slug}-{yyyy-mm-dd}`). Times are set in the site time zone, so 10:00 stays
  10:00 across daylight saving (`occurrenceDates`, `occurrenceTimes`,
  `sameClockOn` in `@ll/content`, unit tested).
- Editing, cancelling or deleting a date asks: this date only, or this and the
  upcoming dates. Upcoming dates take only the fields that changed; new clock
  times go on each date's own day.
- The form: a date range (one day, or several for a multi-day event) with start
  and end times. An event is added and edited in three steps (Details, Date &
  time, Places). A saved one can also jump between steps and save from any of them.
- **One row in the list**: the Events list shows a repeating event once, with
  how many dates it has and the next one. Opening it shows that date, and a
  calendar at the top of the pane moves between the dates (with a choice of time
  on a day with several sessions); each keeps its own form and guest list. Deleting the row deletes the dates shown under the current
  filter.
- **Time zone per event**: each state keeps its own time, so an event takes its
  location's state zone (QLD Brisbane, WA Perth, NT Darwin, SA Adelaide, TAS
  Hobart, NSW and ACT Sydney, VIC Melbourne), and staff can change it. Changing
  the zone keeps the clock times. HubSpot gets `ll_event_time_zone` with the
  start so emails can show local time.
- **Several times a day**: a new event can have more times ("Also at 2:00 pm").
  Every date at every time becomes its own event; same-day sessions get the time
  in their address (`{slug}-{date}-{hhmm}`). "This and upcoming" moves only the
  sessions at the edited session's old time.

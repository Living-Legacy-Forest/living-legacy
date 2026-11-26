# Online booking: the website half, with CMS-sent confirmations (design addendum)

Status: awaiting approval. Size: project (CMS route, website pages, email, one migration).
Builds on [`2026-11-06-event-ticketing-design.md`](2026-11-06-event-ticketing-design.md), which
stays approved. Sections 3 (data), 5 (CMS) and 9 (testing) of that spec apply as written. Where
this document differs from sections 4, 6, 7 and 8, this document wins.

## Intent

Visitors cannot book an event online today: the CMS half exists (events, guest list, check-in,
capacity-safe `insertBooking`), the website half does not. The old design had HubSpot send every
guest email, but HubSpot is not connected (the website's HubSpot portal and form ids are still
unset, and the CMS sync does nothing without a token). Booking online with no confirmation, no
reference and no way to cancel is not acceptable, so the CMS sends the confirmation itself until
HubSpot takes over.

## Goals

- A visitor books a place in under a minute from the website and sees a reference straight away.
- They get a confirmation email with the event details, their reference, an add-to-calendar
  link and a link to cancel.
- An event never takes more people than its capacity, even for simultaneous bookings (the
  existing conditional insert already guarantees this; the route must use it).
- A guest can cancel their own booking from the email link; the places are freed.
- When HubSpot is connected later, turning one setting off hands the emails over, with no schema
  change and no double emails.

## Non-goals

- Reminder emails, cancellation notices, "event changed" emails: HubSpot's job, as before.
- A public waitlist. Staff already run the waitlist in the CMS; a full event shows "Fully
  booked" online.
- Automatically offering freed places to the waitlist.
- Paid tickets, time slots, editing a booking from the website (cancel and rebook instead).
- Connecting HubSpot or filling in `syncBooking`.
- Emailing guests staff add by hand.

## Anti-goals

- A booking that succeeds with nothing for the guest to hold on to. The reference and cancel
  link also appear on the thank-you page, so a late or failed email does not strand them.
- A failed email undoing a real booking. The booking stands; the email is retried.
- The website holding booking rules or the email binding. It validates the form and passes it on;
  the CMS decides.
- Sending names, emails or phone numbers to analytics.

## Approaches considered

- **A. Website half plus CMS-sent confirmation (chosen).** Small reversal of the Nov 6 "CMS
  sends no guest emails" decision, limited to the confirmation. Works today. One setting hands
  over to HubSpot later.
- **B. Website half as specced, no emails.** Fastest, but a guest who closes the tab cannot
  cancel and staff would email people by hand.
- **C. Website half after connecting HubSpot.** Cleanest long term, but blocked on outside
  setup (token, one portal or two, the unverified delete endpoint).

Chosen: A, agreed with the user.

## How it works

**Pages (website, `apps/web`).** `/events/` (upcoming published events, soonest first),
`/events/{slug}/` (details, places left, the booking form or why booking is closed) and
`/events/manage/` (view and cancel). These read the CMS's database directly, as the website
already does for locations and redirects; only writes go through the CMS. Not in the main
navigation; linked from location pages and campaigns; in the sitemap; not indexed while Settings
hides the site.

**Booking.** The form posts to the website's `POST /api/events/book`, which validates the fields
and honeypot, then calls the CMS over a service binding (`CMS`) at `POST /internal/events/book`.
That route checks the shared `INTERNAL_KEY` header, loads the event, refuses a cancelled,
closed, draft or past event, refuses the same email twice for one event (with a message pointing
to the first email), writes the booking with `insertBooking`, creates the manage token, stores
only its hash in `manage_token_hash`, and returns the reference and token. If there was no room
it says the event is full. A limit of 5 bookings a minute per visitor slows bots.

**Confirmation email.** After a website booking with an email address, the CMS sends the
confirmation through `lib/email.ts` (Cloudflare Email Service): event title, date and time in the
event's own time zone, venue, reference, the QR image and add-to-calendar links that already
exist under `/api/tickets/$reference/`, and the cancel link. Sending is skipped when the setting
below is off. A failure never fails the booking; it is recorded and retried (below).

**Setting.** `Send booking confirmations from the CMS`, on by default, kept with the site
settings and shown on the Integrations page next to the HubSpot entry. It is turned off when
HubSpot starts sending the same emails.

**Cancelling.** The email and thank-you links open `/events/manage/?ref=…&token=…`. The page
shows the booking and a Cancel button. Cancelling calls `POST /internal/events/cancel` through
the binding, which compares the token's hash in constant time, sets the booking to cancelled,
frees the places, and marks it for the HubSpot sync. Cancelling twice is harmless. The guest sees
a short confirmation; no email is sent for the cancellation.

**Analytics.** A GA4 `generate_lead` event with `form_type: event_rsvp` on the thank-you page,
only when the visitor has accepted analytics, carrying no personal details.

## Data

One column on `event_bookings`: `confirmation_sent_at` (nullable timestamp), added by a new
migration. The existing 5-minute job retries confirmations for website bookings with an email,
status confirmed, no `confirmation_sent_at`, created in the last 24 hours, and gives up after
that; the guest list shows who did not get one so staff can follow up.

## Constraints

- `AGENTS.md` conventions: server code in `apps/cms/src/server/`, tests beside code, a What's
  new entry and the Settings or Integrations link when it ships, copy in sentence case and
  Australian English following `docs/brand-language.md` (never "plot", "grave", "act now" and so
  on; urgency such as "only 3 places left" must be a true count, not pressure).
- New wiring: a `services` binding and `INTERNAL_KEY` secret on the website, the matching secret
  on the CMS, in the `wrangler` configs and the README's environment list.
- The booking form follows the existing website forms, with one privacy-policy tick that sets
  `consent_at`. The website's React islands are due to move to Svelte, so keep the form thin and
  do no React-specific tuning.
- The visitor-facing wording of every error is plain; a bad key or malformed call returns a
  generic failure and logs the detail.

## Decisions I made (my calls, change any)

- The thank-you page also shows the cancel link, so a failed or late email is not a dead end.
- Staff-added guests get no email.
- A full event shows "Fully booked"; no public waitlist.
- No email on cancellation.
- Confirmation retries run for 24 hours, then stop.
- Public event pages read the database directly; only booking and cancelling use the binding.

## Left to the builder

- How the per-visitor rate limit is enforced (Workers rate limiting binding or a count in D1).
- The exact internal request and response shapes, and the email's HTML.
- Where the setting sits in the Integrations page.
- Reconciling the older spec and plan with the code as it stands: waitlist, promote and QR
  tickets exist in the CMS even though the first spec called them out of scope, and the old plan's
  email tasks assumed Resend, which is gone. Read the current `event-guests.ts`, `tickets.ts` and
  `lib/email.ts` first.
- Whether the thank-you page and the manage page share a component.

## Testing

Integration tests (local D1, as in `booking-store.integration.test.ts`): booking succeeds and
returns a reference; the last place cannot be taken twice; a full, closed, cancelled or past
event is refused; a duplicate email is refused; a wrong or missing `INTERNAL_KEY` is rejected;
the token is never stored in clear; cancel with a wrong token fails, with the right token frees
places and a second cancel changes nothing; an email failure leaves the booking confirmed and
unsent, and the retry sends it; with the setting off nothing is sent. Website unit tests for
form validation and the honeypot. Check the form on a phone at 390px with touch emulation.

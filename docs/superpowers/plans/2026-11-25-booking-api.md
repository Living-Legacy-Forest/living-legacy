# Online booking (website half) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors book a free event on the website, get a reference and a confirmation email from
the CMS, and can cancel from a link; HubSpot can take the emails over later with one setting.

**Architecture:** Booking rules stay in the CMS. The website reads events straight from the shared
D1 for its pages, and sends every write (book, view, cancel) to the CMS over a service binding to
`/internal/events/*`, guarded by a shared key. The CMS writes with the existing capacity-safe
`insertBooking`, derives the cancel token from a secret (so a retried email can rebuild the
link), stores only its hash, and sends the confirmation through Cloudflare Email Service, retried
by the 5-minute cron for 24 hours.

**Tech Stack:** Bun monorepo, Drizzle on Cloudflare D1, TanStack Start (CMS), Astro on Workers
(website), Zod 4, Vitest, Cloudflare Email Service, Workers rate limiting binding.

**Spec:** [`docs/superpowers/specs/2026-11-25-booking-api-design.md`](../specs/2026-11-25-booking-api-design.md),
on top of [`2026-11-06-event-ticketing-design.md`](../specs/2026-11-06-event-ticketing-design.md).

## Global Constraints

- Branch `feat/booking-api` off `master`; Conventional Commits, header ≤ 100 characters.
- Copy is plain, sentence case, Australian English, and follows `docs/brand-language.md`; "places
  left" is only ever a true count.
- Never send names, email addresses or phone numbers to analytics.
- Server functions and stores live in `apps/cms/src/server/`; tests sit beside the code
  (`*.test.ts` plain Node, `*.integration.test.ts` local D1).
- Never edit a shipped migration; add one with `bun run --filter @ll/db generate -- --name <what>`.
- Import tables from `@ll/db/schema`; never import Drizzle into a component.
- The website's React islands are moving to Svelte: keep the one new island thin, no
  React-specific tuning.
- A failed email never fails or undoes a booking.
- The website never holds booking rules or the email binding.

## Decisions this plan makes (beyond the spec)

- **Cancel token derived, not random.** `token = base64url(HMAC-SHA256(MANAGE_TOKEN_SECRET,
booking.id))`, hash stored in `manage_token_hash`. The spec's retry needs the link again, and
  only the hash is stored; deriving it is the only way to rebuild it. Links are checked against
  the stored hash, so rotating the secret breaks only retries, not links already sent.
- **One page for thanks and managing.** After booking, the visitor lands on
  `/events/manage/?ref=…&token=…&new=1` ("You're booked"); the same page without `new` is the
  link from the email. Cancelling is a plain HTML form that posts to that page: no JavaScript.
- **Email is required online.** The confirmation and the cancel link need it. Phone is optional.
- **Guest emails come from their own sender**, `BOOKING_EMAIL_FROM` ("Living Legacy
  <bookings@notify.livinglegacy.com.au>"), not "Living Legacy CMS".
- **Rate limit on the website** with a Workers rate limiting binding: 5 a minute per
  `cf-connecting-ip`.
- **Event pages are not page-cached**, so places left is live; the manage page is
  `private, no-store` and `no-referrer`, since its URL carries the token.

## Review Focus

1. Email typed with different case or spaces (`Sam@Example.com ` vs `sam@example.com`) must still
   count as a duplicate → test in Task 4.
2. The event changes between page load and submit (cancelled, closed, made smaller) → refused
   with the rule's own message → tests in Task 2.
3. A booking cancelled, or the setting turned off, before a retry runs → no email → tests in
   Task 3.
4. A Perth event read by a server in UTC → email shows Perth time → test in Task 3.
5. The manage URL (with its token) leaking through a shared cache or the Referer header →
   headers checked in Task 6, step 7.

---

### Task 1: Shared booking rules for the website

**Files:**

- Create: `packages/content/src/public-booking.ts`, `packages/content/src/public-booking.test.ts`
- Modify: `packages/content/src/events.ts` (beside `guestInputSchema`, to reuse its private
  `NAME`, `isEmail`, `EMAIL_MESSAGE`, `optionalText`, `auPhone`)
- Modify: `packages/content/src/settings.ts` (`SITE_SETTINGS_DEFAULTS`)
- Modify: `packages/content/src/index.ts` (export the new file)

**Interfaces:**

- Produces:
  - `publicBookingSchema` (events.ts): `guestInputSchema` with `email` required (trimmed,
    lowercased, `EMAIL_MESSAGE` when invalid or empty) and `consent: z.literal(true, 'Tick the box
to agree to the privacy policy.')`. `type PublicBookingInput = z.infer<…>`.
  - `bookingState(event: BookableEvent, taken: number, now: number): 'open' | 'not-yet' |
'closed' | 'full' | 'cancelled'`
  - `manageToken(secret: string, bookingId: string): Promise<string>` (base64url, no padding)
  - `hashManageToken(token: string): Promise<string>` (SHA-256, lowercase hex)
  - `safeEqual(a: string, b: string): boolean` (constant time over the longer length)
  - `manageUrl(origin: string, reference: string, token: string): string` →
    `${origin}/events/manage/?ref=${ref}&token=${token}` (both URI-encoded)
  - `internalManageSchema = z.object({ reference: z.string().max(20), token: z.string().min(20).max(100) })`
  - `type ManagedBooking = { reference: string; status: BookingStatus; firstName: string;
partySize: number; event: { title: string; slug: string; startsAt: number; endsAt: number;
timeZone: string; venue: string } }`
  - `type InternalResult<T> = ({ ok: true } & T) | { ok: false; message: string }`
  - `SITE_SETTINGS_DEFAULTS.sendBookingConfirmations = true`

- [ ] **Step 1: Write the failing tests** in `public-booking.test.ts`:

```ts
const valid = {
  eventId: 'e1',
  firstName: 'Sam',
  lastName: '',
  email: ' Sam@Example.TEST ',
  phone: '',
  partySize: 2,
  note: '',
  consent: true,
};
it('lowercases and trims the email', () =>
  expect(publicBookingSchema.parse(valid).email).toBe('sam@example.test'));
it('requires an email', () =>
  expect(publicBookingSchema.safeParse({ ...valid, email: '' }).success).toBe(false));
it('requires consent', () =>
  expect(publicBookingSchema.safeParse({ ...valid, consent: false }).success).toBe(false));

const event = {
  status: 'published',
  startsAt: 2_000,
  endsAt: 3_000,
  bookingsOpenAt: null,
  bookingsCloseAt: null,
  capacity: 10,
  maxPartySize: 6,
} as const;
it.each([
  [{}, 0, 1_000, 'open'],
  [{}, 10, 1_000, 'full'],
  [{ capacity: null }, 99, 1_000, 'open'],
  [{ bookingsOpenAt: 1_500 }, 0, 1_000, 'not-yet'],
  [{}, 0, 2_000, 'closed'],
  [{ status: 'cancelled' }, 0, 1_000, 'cancelled'],
])('bookingState %o taken %i at %i is %s', (patch, taken, now, state) =>
  expect(bookingState({ ...event, ...patch }, taken, now)).toBe(state)
);

it('derives the same token for the same booking', async () => {
  const a = await manageToken('s', 'b1');
  expect(a).toBe(await manageToken('s', 'b1'));
  expect(a).not.toBe(await manageToken('s', 'b2'));
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
});
it('hashes to 64 hex characters', async () =>
  expect(await hashManageToken('abc')).toMatch(/^[0-9a-f]{64}$/));
it('compares safely', () => {
  expect(safeEqual('abc', 'abc')).toBe(true);
  expect(safeEqual('abc', 'abd')).toBe(false);
  expect(safeEqual('abc', 'abcd')).toBe(false);
});
it('builds the manage link', () =>
  expect(manageUrl('https://x.test', 'LL-ABC234', 'a-b_c')).toBe(
    'https://x.test/events/manage/?ref=LL-ABC234&token=a-b_c'
  ));
it('sends confirmations by default', () => {
  expect(parseSiteSettings(undefined).sendBookingConfirmations).toBe(true);
  expect(parseSiteSettings({ sendBookingConfirmations: false }).sendBookingConfirmations).toBe(
    false
  );
});
```

- [ ] **Step 2: Run and see them fail:** `bun run --filter @ll/content test public-booking` →
      FAIL, imports not found.
- [ ] **Step 3: Implement** the interfaces above. `bookingState` maps from `bookingProblem(event,
1, taken, now, 'website')` so the two can never disagree (a draft counts as `closed`). The
      crypto uses `crypto.subtle` only, which Workers and Node both have.
- [ ] **Step 4: Run and see them pass**, plus the package's type check:
      `bun run --filter @ll/content test && bun run --filter @ll/content type-check` → PASS.
- [ ] **Step 5: Commit:** `feat(content): rules for booking an event from the website`

---

### Task 2: CMS booking store for website bookings

**Files:**

- Modify: `packages/db/src/schema/events.ts` (`eventBookings`: add `confirmationSentAt:
integer('confirmation_sent_at', { mode: 'timestamp_ms' })` after `crmError`)
- Create: migration via `bun run --filter @ll/db generate -- --name booking-confirmation-sent`
- Create: `apps/cms/src/server/public-bookings.ts`, `apps/cms/src/server/public-bookings.integration.test.ts`

**Interfaces:**

- Consumes: `insertBooking` (booking-store.ts), `bookingProblem`, `seatsTaken`,
  `publicBookingSchema` types, `manageToken`, `hashManageToken`, `safeEqual`, `ManagedBooking`.
- Produces:
  - `bookFromWebsite(db: Db, input: PublicBookingInput, secret: string, now = Date.now()):
Promise<InternalResult<{ id: string; reference: string; token: string }>>`
  - `viewBooking(db: Db, reference: string, token: string): Promise<ManagedBooking | null>`
  - `cancelFromWebsite(db: Db, reference: string, token: string, now = new Date()):
Promise<ManagedBooking | null>`
  - `DUPLICATE_MESSAGE = 'You have already booked this event. Use the link in your confirmation email to see or cancel your booking.'`

- [ ] **Step 1: Add the column and generate the migration;** apply it with
      `bun run --filter @ll/cms db:migrate:local`. Expected: one new `ALTER TABLE event_bookings ADD
confirmation_sent_at` migration.
- [ ] **Step 2: Write the failing tests.** Insert events the way
      `booking-store.integration.test.ts` does; clear `event_bookings` and `events` in `beforeEach`.
  - `books an open event`: `ok`, `reference` matches `/^LL-/`; the row has `source = 'website'`,
    `consent_at` set, `manage_token_hash === await hashManageToken(token)`, and no column equals
    `token`.
  - `never takes the last place twice`: capacity 2; `Promise.all` of two `partySize: 2` bookings
    → exactly one `ok`; the other's message is `'This event is fully booked.'`.
  - `refuses what the rules refuse`, one case each with `bookingProblem`'s exact message: draft
    `'This event is not open for bookings.'`, cancelled `'This event has been cancelled.'`, past
    the close `'Bookings for this event have closed.'`, 7 people with max 6 `'Bookings are limited
to 6 people.'`; an unknown or deleted event id → `'This event is not open for bookings.'`.
  - `refuses the same email twice` → `DUPLICATE_MESSAGE`; a cancelled earlier booking with that
    email does not block.
  - `views with the right token only`: right token → `ManagedBooking` with the event's title;
    wrong token → null; a staff booking (no hash) → null.
  - `cancels and frees the places`: wrong token → null, still confirmed; right token → status
    `cancelled`, `crm_synced_at` null, and a new booking for the freed places succeeds; cancelling
    again returns the cancelled booking with `cancelled_at` unchanged.
- [ ] **Step 3: Run and see them fail:**
      `bun run --filter @ll/cms test:integration public-bookings` → FAIL, module not found.
- [ ] **Step 4: Implement `public-bookings.ts`.** Check the rules, then the duplicate (confirmed
      booking for this event with this email), then `insertBooking({ …, source: 'website', consentAt:
new Date(now) }, event.capacity)`; `null` from it means full. Then set `manage_token_hash` from
      `manageToken(secret, id)`. Token checks hash the given token and use `safeEqual`.
- [ ] **Step 5: Run and see them pass:** same command → PASS.
- [ ] **Step 6: Commit:** `feat(cms): book, view and cancel event bookings made on the website`

---

### Task 3: Confirmation email and its retry

**Files:**

- Modify: `apps/cms/src/lib/email.ts` (optional `from` on `Email`; new builder and sender)
- Create: `apps/cms/src/lib/email.test.ts`
- Create: `apps/cms/src/server/booking-confirmations.ts`,
  `apps/cms/src/server/booking-confirmations.integration.test.ts`
- Modify: `apps/cms/src/lib/cron-jobs.ts`, `apps/cms/src/server/cron-jobs.ts`
- Modify: `apps/cms/wrangler.jsonc` vars: `WEBSITE_URL: "https://livinglegacy.com.au"`,
  `BOOKING_EMAIL_FROM: "Living Legacy <bookings@notify.livinglegacy.com.au>"`
- Modify: `apps/cms/src/env.d.ts`: `MANAGE_TOKEN_SECRET?: string`

**Interfaces:**

- Consumes: `manageToken`, `manageUrl` (Task 1); `confirmation_sent_at` (Task 2).
- Produces:
  - `type BookingConfirmation = { firstName: string; reference: string; partySize: number;
title: string; startsAt: number; endsAt: number; timeZone: TimeZone; venue: string;
manageUrl: string; calendarUrl: string; qrUrl: string }`
  - `bookingConfirmationEmail(c: BookingConfirmation): { subject: string; html: string; text: string }`
  - `sendBookingConfirmationEmail(to: string, c: BookingConfirmation): Promise<void>` (sends from
    `env.BOOKING_EMAIL_FROM`)
  - `type ConfirmDeps = { send: (to: string, c: BookingConfirmation) => Promise<void>; secret:
string; websiteOrigin: string; cmsOrigin: string; enabled: () => Promise<boolean> }`
  - `confirmDeps(): ConfirmDeps` (from env and `readSiteSettings()`)
  - `confirmBooking(db: Db, bookingId: string, deps = confirmDeps(), now = new Date()):
Promise<'sent' | 'skipped' | 'failed'>`
  - `retryConfirmations(db: Db, deps = confirmDeps(), now = new Date()): Promise<{ sent: number; failed: number }>`
  - Cron job `{ key: 'send-booking-confirmations', schedule: 'every-5-minutes', title: 'Resend booking confirmations' }`

- [ ] **Step 1: Write the failing unit tests** in `email.test.ts`:
  - subject is `` `You're booked: ${title}` ``.
  - `text` contains the reference, `${partySize} people` (or `1 person`), the venue, the
    calendar URL and the manage URL.
  - A Perth event (`timeZone: 'Australia/Perth'`, `startsAt: Date.UTC(2027, 0, 20, 2, 0)`)
    shows `10:00` in `text` and names Perth time.
  - `html` contains the QR `<img` with `alt="Your ticket code"` and the button label `See or
cancel your booking`.
- [ ] **Step 2: Write the failing integration tests** with a fake `deps` that records calls:
  - `sends once and stamps it`: `'sent'`, one call, `confirmation_sent_at` set; a second call →
    `'skipped'`, still one call.
  - `the link works`: the recorded `manageUrl`'s token hashes to the row's `manage_token_hash`.
  - `skips when turned off` (`enabled → false`): `'skipped'`, no call, not stamped.
  - `skips staff bookings, cancelled bookings and bookings with no email`.
  - `a failure keeps the booking`: `send` throws → `'failed'`, booking still confirmed, not stamped.
  - `retries for a day`: unsent booking 1 hour old is sent by `retryConfirmations`; one 25 hours
    old is not; a cancelled one is not; the result counts `{ sent: 1, failed: 0 }`.
- [ ] **Step 3: Run and see them fail:** `bun run --filter @ll/cms test email booking-confirmations` → FAIL.
- [ ] **Step 4: Implement.** The email uses `layout()` with the existing `formatDateTime` and
      `zoneName`; `calendarUrl` is `${cmsOrigin}/api/tickets/${reference}/calendar`, `qrUrl`
      `${cmsOrigin}/api/tickets/${reference}/qr`. `confirmBooking` catches and logs a send error
      (never the address) and returns `'failed'`. The cron entry throws when `failed > 0`, like
      `publish-posts`, so the run is reported.
- [ ] **Step 5: Run and see them pass,** with the cron tests:
      `bun run --filter @ll/cms test` → PASS (`cron-jobs.test.ts` included).
- [ ] **Step 6: Commit:** `feat(cms): email a confirmation for each website booking, retried for a day`

---

### Task 4: The internal endpoint the website calls

**Files:**

- Create: `apps/cms/src/server/internal-api.ts`, `apps/cms/src/server/internal-api.integration.test.ts`
- Modify: `apps/cms/src/server.ts` (route `/internal/` before `loadApp`, like the health check;
  update the cron comment)
- Modify: `apps/cms/src/env.d.ts`: `INTERNAL_KEY?: string`

**Interfaces:**

- Consumes: Task 2's three functions, `confirmBooking` (Task 3), `publicBookingSchema`,
  `internalManageSchema`, `safeEqual`.
- Produces: `internalResponse(request: Request, env: Cloudflare.Env, ctx: Pick<ExecutionContext,
'waitUntil'>): Promise<Response>`. All bodies are JSON `InternalResult<…>`.

| Path (POST only)          | Body                   | Success                        | Failure          |
| ------------------------- | ---------------------- | ------------------------------ | ---------------- |
| `/internal/events/book`   | `PublicBookingInput`   | 200 `{ ok, reference, token }` | 409 rule message |
| `/internal/events/view`   | `{ reference, token }` | 200 `{ ok, booking }`          | 404              |
| `/internal/events/cancel` | `{ reference, token }` | 200 `{ ok, booking }`          | 404              |

Not found message: `'We could not find that booking. Check the link in your confirmation email.'`.
Wrong or missing `x-internal-key` → 401; `INTERNAL_KEY` unset → 503; bad JSON or schema → 400
with the first issue's message; another method → 405; another path → 404. A successful booking
queues `confirmBooking` with `ctx.waitUntil`, so the visitor does not wait for the email.

- [ ] **Step 1: Write the failing tests** with `env.INTERNAL_KEY = 'test-key'`,
      `env.MANAGE_TOKEN_SECRET = 'test-secret'` and a fake `ctx` collecting promises: one test per
      row and status above; `queues one confirmation per booking`; and Review Focus 1:
      `treats Sam@Example.com  and sam@example.com as the same guest` → second call 409 with
      `DUPLICATE_MESSAGE`.
- [ ] **Step 2: Run and see them fail:** `bun run --filter @ll/cms test:integration internal-api` → FAIL.
- [ ] **Step 3: Implement** `internal-api.ts` and the `server.ts` branch
      (`if (url.pathname.startsWith('/internal/'))`, lazy import).
- [ ] **Step 4: Run and see them pass:** same command → PASS.
- [ ] **Step 5: Commit:** `feat(cms): internal booking endpoint for the website, behind a shared key`

---

### Task 5: Website wiring and the booking endpoint

**Files:**

- Modify: `apps/web/wrangler.jsonc`: `"services": [{ "binding": "CMS", "service":
"living-legacy-cms" }]`, `"ratelimits": [{ "name": "BOOKING_LIMITER", "namespace_id": "1001",
"simple": { "limit": 5, "period": 60 } }]`
- Create: `apps/web/src/lib/cms-internal.ts`, `apps/web/src/pages/api/events/book.ts`
- Modify: `apps/web/src/lib/page-cache.ts` (`isCacheablePage` false under `/events/`)

**Interfaces:**

- Consumes: the endpoint table in Task 4; `publicBookingSchema`.
- Produces:
  - `callCms<T>(path: '/internal/events/book' | '/internal/events/view' | '/internal/events/cancel',
body: unknown): Promise<{ status: number; data: InternalResult<T> }>`: `env.CMS.fetch` to
    `https://cms.internal${path}` with `x-internal-key: env.INTERNAL_KEY`; throws if either is
    missing.
  - `POST /api/events/book`: honeypot field `company` filled → 400; limiter says no → 429
    `'Too many bookings from here in a minute. Wait a moment and try again.'`; invalid → 400
    with the first issue's message; otherwise the CMS's status and body; a throw → 502
    `'We could not take your booking just now. Please try again, or call us.'`.

- [ ] **Step 1: Implement** the wiring, `callCms` and the endpoint. Declare `CMS`,
      `BOOKING_LIMITER` and `INTERNAL_KEY` on the `env` slice the way `settings.ts` declares `DB`.
- [ ] **Step 2: Check it builds:** `bun run --filter @ll/web type-check && bun run --filter @ll/web build` → no errors.
- [ ] **Step 3: Try it against the local CMS** (`bun run dev:cms`, `bun run dev:web`, the same
      `INTERNAL_KEY` in both `.dev.vars`): `curl -X POST localhost:4321/api/events/book` with a
      valid body for a published local event → 200 with a reference; again → 409; an empty body → 400. If the binding cannot reach the local CMS, note it in the PR and check this step on the
      preview deploy instead.
- [ ] **Step 4: Commit:** `feat(web): booking endpoint that hands bookings to the CMS`

---

### Task 6: Event pages, the booking form and the manage page

**Files:**

- Create: `apps/web/src/lib/events.ts`
- Create: `apps/web/src/pages/events/index.astro`, `apps/web/src/pages/events/[slug].astro`,
  `apps/web/src/pages/events/manage.astro`
- Create: `apps/web/src/components/forms/EventBookingForm.tsx`
- Modify: `apps/web/src/lib/analytics.ts` (`FormType` gains `'event_rsvp'`)
- Modify: `apps/web/src/lib/page-sitemap.ts` (`/events/` and each upcoming published event)

**Interfaces:**

- Consumes: `bookingState`, `renderRichText`, `callCms`, `manageUrl` shape, `trackLead`.
- Produces:
  - `type PublicEvent = { id: string; slug: string; title: string; summary: string; startsAt:
number; endsAt: number; timeZone: string; venue: string; heroMediaId: string | null; status:
'published' | 'cancelled'; placesLeft: number | null; state: ReturnType<typeof bookingState> }`
  - `getUpcomingEvents(now = Date.now()): Promise<PublicEvent[]>`: published or cancelled, not
    deleted, `ends_at > now`, soonest first.
  - `getEventBySlug(slug: string, now = Date.now()): Promise<(PublicEvent & { description: string |
null; maxPartySize: number }) | null>`

- [ ] **Step 1: `lib/events.ts`** with raw `DB.prepare` queries, as `settings.ts` does; times
      shown with `Intl` in `en-AU` in the event's own `timeZone`.
- [ ] **Step 2: The two event pages** in `BaseLayout`. List cards show date, place, and
      `Fully booked` / `Cancelled` badges. The detail page shows the hero (the media URL pattern in
      `blog-cms.ts`), description, places left (`1 place left`, `${n} places left`, `Fully booked`;
      nothing when there is no limit), then the form when `state === 'open'`, otherwise one line:
      `not-yet` "Bookings open on {date}.", `closed` "Bookings for this event have closed.",
      `full` "This event is fully booked.", `cancelled` "This event has been cancelled." An unknown
      slug is a 404.
- [ ] **Step 3: `EventBookingForm.tsx`** (`client:load`, props `{ eventId: string; maxPartySize:
number }`), modelled on `ContactForm.tsx`: first name, last name (optional), email, phone
      (optional), people (1 to `maxPartySize`), "Accessibility or dietary needs" (optional), the
      privacy tick, the honeypot. On `ok`: `await trackLead('event_rsvp')`, then go to
      `/events/manage/?ref=…&token=…&new=1`. On an error: `toast.error(message)` and keep what was
      typed. Check `trackLead` already waits for analytics consent, as the other forms rely on.
- [ ] **Step 4: `manage.astro`.** GET calls `/internal/events/view`; POST (the Cancel form)
      calls `/internal/events/cancel`, then renders. Heading "You're booked" when `new=1` and
      confirmed, "Your booking" otherwise, "Booking cancelled" once cancelled. It shows the
      reference, event, date and time, people, and while confirmed a form with one button "Cancel my
      booking" and the line "This frees your places for someone else." Not found → the Task 4
      message and the site's phone number. Responses set `Cache-Control: private, no-store` and
      `Referrer-Policy: no-referrer`, and the page is `noindex`.
- [ ] **Step 5: Sitemap and analytics type** as listed under Files; `/events/manage/` stays out.
- [ ] **Step 6: Check it builds:** `bun run --filter @ll/web type-check && bun run --filter @ll/web build` → no errors.
- [ ] **Step 7: Try it in the browser** at 390px with touch emulation and on desktop: book, land
      on "You're booked", cancel, see "Booking cancelled", and see places left go down and back up.
      Review Focus 5: `curl -I` the manage URL shows `no-store` and `no-referrer`; the event page has
      no `cf-cache-status: HIT` on a second load.
- [ ] **Step 8: Commit:** `feat(web): event pages, online booking and managing a booking`

---

### Task 7: CMS controls, docs and release notes

**Files:**

- Modify: `apps/cms/src/components/integrations/services-section.tsx` (Cloudflare Email Service
  row: `does` becomes "Sends sign-in links, and confirmations to guests who book on the
  website."; a switch "Send booking confirmations from the CMS" with the note "Turn this off once
  HubSpot sends booking emails, so guests don't get two.")
- Modify: the settings save path in `apps/cms/src/server/settings.ts`, so `sendBookingConfirmations` saves
- Modify: `apps/cms/src/server/event-guests.ts` (`getGuests` returns `confirmationSentAt`) and the
  row component that renders a `Guest` (trailing "No confirmation sent" for a confirmed website
  booking with an email, no `confirmationSentAt`, made more than 10 minutes ago)
- Modify: `apps/cms/src/lib/whats-new.ts` (new entry at the top, dated the day it ships:
  "Online booking" — "People can now book events on the website. They get a confirmation email
  with a link to cancel, and their booking shows in the guest list." Link `/events`.)
- Modify: `README.md` (secrets `INTERNAL_KEY` on both Workers, `MANAGE_TOKEN_SECRET` on the CMS;
  vars `WEBSITE_URL`, `BOOKING_EMAIL_FROM`), `docs/observability.md` (the new cron job)

- [ ] **Step 1: Write the failing test** for saving, in `apps/cms/src/server/settings.integration.test.ts`
      (create it if there is none): saving `sendBookingConfirmations: false` reads back `false`.
- [ ] **Step 2: Run it and see it fail;** implement; run and see it pass:
      `bun run --filter @ll/cms test:integration settings`.
- [ ] **Step 3: The switch and the guest list label;** check both at 390px and on desktop.
- [ ] **Step 4: What's new, README and observability notes.**
- [ ] **Step 5: Run what CI runs:** `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build` → all pass.
- [ ] **Step 6: Commit:** `feat(cms): turn booking confirmations off for HubSpot, and flag unsent ones`

Before deploying: set `INTERNAL_KEY` (same value) on both Workers and `MANAGE_TOKEN_SECRET` on the
CMS with `wrangler secret put`, deploy the CMS first (the website's binding needs it), then the
website.

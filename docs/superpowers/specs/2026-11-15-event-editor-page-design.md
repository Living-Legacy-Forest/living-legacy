# Event editor as a full page: design

Date: 2026-11-15
Status: draft, awaiting approval

Part 1 of 2 in "enhance events". Part 2 (website event pages and online booking) is
designed separately, after this ships.

## 1. Intent

Events are edited today in a right-hand pane (a dialog on phones), and a new event is made
in a three-step form (Details, Date & time, Places). It works, but it is cramped for what
an event now holds: a rich description, photos, several sessions, a booking window and a
guest list. Posts already have a roomy full-page editor, and editors find it more
comfortable.

Give events the same kind of page, so planning an open day and running it happen in one
place, and so Part 2 has room to add booking questions and ticket types without
squeezing a pane.

**Success looks like**

- An editor creates or edits an event on its own page, and the description is the centre
  of it, as with a post.
- Bookings and the guest list are one click away from the same page, so one screen covers
  planning and running the event.
- Nothing an editor could do in the pane or the three steps is lost.
- It is comfortable at 390px on a touch screen, not just on desktop.

## 2. Goals, non-goals, anti-goals

**Goals**

- Routes `/events/new` and `/events/$eventId`, replacing the pane and the dialog for
  create and edit.
- Layout agreed with the owner (mockup option C): main column for the story, a side
  panel that leads with bookings.
- Keep every existing capability: repeat rules, several sessions a day, multi-day dates,
  "this date only or this and upcoming", time zone, photos, publish, schedule publish,
  cancel, delete, preview, guests, QR scanning, dashboard.

**Non-goals**

- No database or migration changes, no new event fields.
- No change to booking rules, the HubSpot sync or the QR ticket.
- No website pages, online booking, ticket types, custom questions or waitlist (Part 2).
- The events list, overview and dashboards keep their look; only where a row leads
  changes.
- No restyle of the rich-text editor itself. That area is due a reorganisation; reuse
  whatever the event form already uses for the description.

**Anti-goals**

- A page that is worse on a phone than the dialog it replaces.
- Losing someone's unsaved work on navigating away without warning.
- Two ways to edit an event that drift apart (leaving the old pane form alive).

## 3. The page (decided with the owner)

**Top bar:** back to Events, the event's status badge (draft, published, cancelled), then
Preview and Publish. Cancel event, Delete and Schedule publish live in the bar's overflow
menu or wherever the post editor puts the same actions.

**Main column, top to bottom:** cover photo; title; summary; the rich-text description;
then a Sessions section for the dates and times, holding the existing repeat field, the
"also at" extra times and, on a saved event in a series, the calendar that moves between
its dates.

**Side panel**, in this order:

1. **Bookings:** "12 / 50 booked", checked-in count, and a link to the guest list.
2. **Places and booking:** capacity, maximum party size, when bookings open and close.
3. **Location:** place, venue, time zone.
4. **Gallery.**
5. **Web address** (slug).

On `lg` and up the panel sits beside the main column and can be collapsed, as in the
post editor. Below `lg` it stacks under the main column.

**Guests and Dashboard** stay as views of the same event, kept in the existing `?view=`
search value (`details` is the default). The guest list, check-in, scanner and CSV export
work as they do now; the page just gives them the full width.

**New event:** `/events/new` is the same layout with empty fields. Title and a first date
are required. Save creates a draft and moves to `/events/$eventId`. A new event no longer
walks three steps, because the page shows everything, with the existing check of times
on save.

**Unsaved changes:** leaving with edits asks first, as the post editor does.

## 4. Constraints

- Follow `AGENTS.md`: CMS conventions, `useAction()` for mutations, shadcn `Spinner` for
  loading, icons from `@/components/icons`, validation errors as Sonner toasts on submit
  (never inline), sentence-case Australian English.
- Permissions are unchanged: `events:manage`, checked on the server.
- Phones: 44pt rows (`touch:min-h-11`), anything hover-only needs a touch route, check
  at 390px with touch emulation.
- The existing server functions in `server/events.ts` and `server/event-guests.ts` are
  reused as they are. Extending one is fine; changing what it saves is not.
- Add a What's new entry for the new page.

## 5. Decisions already made, and my calls

Made by the owner: option C layout, a full page like posts, online booking comes after.

My calls (change any of them):

- **Order:** editor page before website booking, because it is CMS only and gives
  Part 2 somewhere to put new fields.
- **List rows open the page on every screen size.** The right-hand pane and
  `ListDialog` for events are removed. Anything in the list that exists only to show the
  edit pane goes with it; the row charts and expanding rows stay.
- **Old links keep working.** `/events/?open=<id>&view=…` redirects to
  `/events/<id>?view=…`. Three places link that way today: Content checks, notifications
  and search-replace results (`search-replace-store.ts`); point them at the new route and
  keep the redirect for anyone's bookmarks.
- **A series is edited one date at a time**, as now, with the calendar in the Sessions
  section moving between dates and the existing scope question on save.

## 6. Left to the builder

- Reuse of the post editor's pieces (toolbar, resizable panels, presence, properties
  panel) versus a small event-specific equivalent: build on what is shared, copy nothing
  from the rich-text editor area.
- How much of `event-form.tsx` is split into section components (it is about 30 KB).
- Exact overflow-menu contents and the phone arrangement of the side panel.
- Whether presence ("someone else is editing") is worth carrying over from posts.

## 7. Testing

- Existing unit and integration tests keep passing; no server rules change.
- Add tests for any new pure logic (for example the redirect from old links).
- Browser checks at desktop and at 390px with touch emulation: create a single event,
  create a repeating one, edit one date and "this and upcoming", publish, schedule,
  cancel, delete, open guests, check a guest in, export CSV, preview, old `?open=` link.
- Run what CI runs: type-check, lint, format check, test, build.

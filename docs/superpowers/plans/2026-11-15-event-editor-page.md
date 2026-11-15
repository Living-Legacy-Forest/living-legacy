# Event editor page: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Events are created and edited on their own full page (`/events/new`,
`/events/$eventId`), laid out like the post editor, in place of the list's right-hand
pane, the phone dialog and the three-step form.

**Architecture:** A new loader (`getEventPage`) returns one event, its series dates and
the locations. The event form's state and rules move out of `event-form.tsx` into pure
helpers and a `useEventEditor` hook. The page composes a main column and a side panel in
the post editor's `ResizablePanels`, and Guests and Dashboard become views of the page
(`?view=`). The events list then links rows to the page, and the pane, dialog and old
form are deleted.

**Tech Stack:** TanStack Start + Router, React, shadcn on Base UI, Tailwind 4, Drizzle on
D1, Vitest (unit: plain Node; integration: local D1 via Miniflare).

**Spec:** `docs/superpowers/specs/2026-11-15-event-editor-page-design.md`

## Global Constraints

- No database schema or migration changes; no new event fields.
- No change to what `saveEvent`, `cancelEvent`, `deleteEvent`, the guest functions or the
  HubSpot sync save. Reading more is fine.
- Permission for every new server function and route: `events:manage`.
- Mutations through `useAction()`; loading uses `Spinner` from `components/ui/spinner`;
  icons from `@/components/icons`; validation errors are Sonner toasts on submit (via
  `notify.error` / `reportInvalid`), never inline.
- Page heading is `<h1 data-slot="page-title">`.
- Copy is plain, sentence case, Australian English. Keep the existing strings of moved
  code word for word unless this plan gives new ones.
- Touch: rows and controls at least 44pt (`touch:min-h-11`); nothing reachable only by
  hover. Check at 390px with touch emulation.
- Don't copy patterns from `components/editor` or `components/extensions`; use
  `RichTextField` for the description, as now.
- Commits are Conventional Commits, `feat(cms): …`, header at most 100 characters,
  ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Format what you touch: `bunx prettier --write <paths>`.

## Review Focus

1. **A date of a series edited on the page:** Save asks "This date only / This and
   upcoming dates". Choosing upcoming must stay on the same date's page, and that
   page's data must refresh. Test: Task 1 `loadEventPage` returns sibling dates in start
   order. Browser check in Task 6.
2. **Leaving with unsaved edits:** back to Events, the sidebar, the series date picker
   (it navigates to another date) and closing the tab all warn. Save, Create, Cancel event
   and Delete must not warn. Test: Task 2 `isEventDirty`. Browser check in Task 6.
3. **An event deleted or missing** (stale link, a date deleted from another tab): the
   page shows an empty state with a link back to Events, not a crash. Test: Task 1
   `loadEventPage` returns `null` for an unknown id.
4. **A cancelled event** opens read-only with Preview and Delete only, as today. Browser
   check in Task 6.
5. **Old `?open=` links** from Content checks, notifications, search-replace and
   bookmarks land on the right page and tab. Test: Task 5 route redirect helper
   `legacyEventRedirect`.

---

### Task 1: Load one event for its page

**Files:**

- Modify: `apps/cms/src/server/events.ts` (extract the row select from `listEvents`, add
  `loadEventPage` and `getEventPage`)
- Test: `apps/cms/src/server/event-page.integration.test.ts`

**Interfaces:**

- Produces:
  - `loadEventPage(db: Db, id: string): Promise<EventPageData | null>`
  - `type EventPageData = { event: EventRow; dates: EventRow[]; locations: LocationOption[] }`.
    `dates` holds every date of the event's series (the event included), soonest first,
    and is `[]` when `seriesId` is null.
  - `getEventPage` server fn, GET, `requirePermission('events:manage')`, validator
    `z.object({ id: z.string().max(64) })`, returns `loadEventPage(getDb(), id)`.
  - `getEventLocations` server fn, GET, same permission, returns `LocationOption[]` (for
    `/events/new`).
- `EventRow` and `LocationOption` keep their current shape; `listEvents` keeps its
  output exactly.

- [ ] **Step 1: Write the failing tests** in `event-page.integration.test.ts`, with
      `addLocation` / `addEvent` / `book` helpers in the style of
      `event-stats.integration.test.ts` and `beforeEach` clearing `eventBookings`, `events`
      and `locations`:
  - `returns the event with its booking counts`: event capacity 50, bookings of 3
    (checked in) and 2, plus a cancelled booking of 4. Expect `event.booked === 5`,
    `event.bookings === 2`, `event.checkedIn === 3`, `event.locationName` is the
    location's name, `dates` equals `[]`.
  - `returns every date of its series, soonest first`: three events sharing `seriesId`
    inserted out of order. Load the middle one; expect `dates.map(d => d.id)` in start
    order, length 3.
  - `returns the live locations`: one live and one with `deletedAt` set; expect only the
    live one.
  - `returns null for an unknown id`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:integration -- event-page` and
      expect FAIL (`loadEventPage` is not exported).
- [ ] **Step 3: Implement.** Move the select and the row mapping out of `listEvents`
      into `eventRowsQuery(db, where?)` and `toEventRow(row)`, and the locations select into
      `locationOptions(db)`. `listEvents` calls them and returns exactly what it did. Then
      `loadEventPage` selects the event by id. If it has a `seriesId`, it selects the dates
      with that `seriesId` ordered by `startsAt`, and it adds the locations, in one
      `db.batch` where practical.
- [ ] **Step 4: Run** the same command and expect PASS. Also run
      `bun run --filter @ll/cms test:integration -- event-stats` to confirm nothing moved.
- [ ] **Step 5: Commit** `feat(cms): load one event, its dates and locations for its own page`.

### Task 2: Pure event editor rules

**Files:**

- Create: `apps/cms/src/components/events/editor/event-values.ts`
- Test: `apps/cms/src/components/events/editor/event-values.test.ts`
- Modify: `apps/cms/src/components/events/event-form.tsx` (import from the new module
  until Task 5 deletes it)

**Interfaces:**

- Produces (all moved from `event-form.tsx` unless new):
  - `type EventValues` (the current `Values`)
  - `initialEventValues(event: EventRow | null, siteZone: string): EventValues` (the
    current `initialValues`, same defaults, `maxPartySize: 10`)
  - `rezoneValues(v: EventValues, next: string): EventValues` (the current `rezone` body)
  - `expandEventTimes(first: EventTimes, repeat: RepeatValue, sessions: SessionTime[], zone: string): EventTimes[]`
    (the current `allTimes`, first entry is `first`)
  - `timesProblem(input: { times: EventTimes | null; sessions: SessionTime[]; zone: string; repeat: RepeatValue; isNew: boolean }): string | null`
    (new: the checks of `timesReady`, returning the toast description or null)
  - `isEventDirty(values: EventValues, saved: EventValues, extras: { sessions: SessionTime[]; repeat: RepeatValue }): boolean`
    (new: true if values differ by `JSON.stringify`, or a session was added, or
    `repeat.repeat !== 'none'`)

- [ ] **Step 1: Write the failing tests:**
  - `timesProblem` returns `'Pick its date and times.'` for `times: null`;
    `'It must end after it starts.'` when `endsAt <= startsAt`;
    `'Each extra time needs a start and a later end, like 2:00 pm to 4:00 pm.'` for a
    session with end before start; `'Pick when it stops repeating.'` for a new weekly
    repeat with `ends: 'until'` and no `until`; null for that same repeat when
    `isNew: false`; null for a valid single event.
  - `expandEventTimes` with a weekly repeat of 3 dates and one extra session returns 6
    times, and the extra session keeps its clock time on each date in
    `Australia/Melbourne` across the October daylight saving change (`2026-09-26`,
    `2026-10-03`, `2026-10-10`).
  - `rezoneValues` from Melbourne to Perth keeps 10:00 at 10:00 for `startsAt` and leaves
    a null `bookingsOpenAt` null.
  - `isEventDirty` is false for `initialEventValues(event, zone)` against itself, true
    after changing `title`, and true for a new event with one added session.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- event-values` and expect FAIL.
- [ ] **Step 3: Implement** by moving the code out of `event-form.tsx`. `EventForm`
      imports and uses the new functions; `timesReady` becomes
      `const problem = timesProblem(…); if (problem) notify.error('Check the event', problem)`.
- [ ] **Step 4: Run** the unit test (PASS) and `bun run type-check` (clean).
- [ ] **Step 5: Commit** `refactor(cms): event form rules as pure, tested helpers`.

### Task 3: The event editor page (Details)

**Files:**

- Create: `apps/cms/src/components/events/editor/use-event-editor.ts`
- Create: `apps/cms/src/components/events/editor/event-actions.tsx` (move `ScopeDialog`,
  `ScopeActions`, `CancelEvent`, `DeleteEvent`, `PreviewButton`, `CancelledEvent` from
  `event-form.tsx`)
- Create: `apps/cms/src/components/events/editor/event-main.tsx` (main column)
- Create: `apps/cms/src/components/events/editor/event-side-panel.tsx`
- Create: `apps/cms/src/components/events/editor/event-toolbar.tsx`
- Create: `apps/cms/src/components/events/editor/event-editor.tsx`
- Create: `apps/cms/src/routes/_app/events/new.tsx`
- Create: `apps/cms/src/routes/_app/events/$eventId.tsx`
- Modify: `apps/cms/src/lib/nav.ts` (`isEditorPath`, new `editorBack`)
- Modify: `apps/cms/src/components/shell/app-header.tsx` (use `editorBack`)
- Test: `apps/cms/src/lib/nav.test.ts`

**Interfaces:**

- Consumes: Task 1 `getEventPage`, `getEventLocations`, `EventPageData`; Task 2 helpers.
- Produces:
  - `useEventEditor({ event, locations, onSaved }: { event: EventRow | null; locations: LocationOption[]; onSaved: (id: string) => void })`
    returns `{ values, patch, zone, rezone, setZoneChosen, sessions, setSessions, repeat, setRepeat, times, dirty, pending, submit, askScope, setAskScope, save, previewDraft, blocker }`.
    `save(scope)` calls `saveEvent` exactly as `EventForm.save` does, then `onSaved(id)`.
    The blocker uses `useBlocker({ shouldBlockFn, enableBeforeUnload, withResolver: true })`
    the way `use-post-editor.ts` does, and is skipped for the navigation that follows a
    save, a cancel or a delete.
  - `EventEditor({ data, reveal, onReload }: { data: { event: EventRow | null; dates: EventRow[]; locations: LocationOption[] }; reveal?: boolean; onReload: () => Promise<void> })`
  - `isEditorPath(pathname)` is true for `/events/new` and `/events/<id>`, false for
    `/events`, `/events/overview` and the existing post cases.
  - `editorBack(pathname): { to: '/posts' | '/events'; label: string } | null`

- [ ] **Step 1: Write the failing tests** in `nav.test.ts`:
  - `isEditorPath('/events/01J0ABC')` and `isEditorPath('/events/new')` are true;
    `isEditorPath('/events')` and `isEditorPath('/events/overview')` are false.
  - `editorBack('/events/01J0ABC')` equals `{ to: '/events', label: 'Events' }`.
  - `editorBack('/posts/01J0ABC')` equals `{ to: '/posts', label: 'Posts' }`.
  - `editorBack('/media')` is null.
  - `findNavItem('/events/01J0ABC')?.title` is `'All events'`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- nav` and expect FAIL.
- [ ] **Step 3: Implement `isEditorPath` and `editorBack`**, and have `app-header.tsx`
      use `editorBack(pathname)` instead of its hard-coded posts object. Run the test: PASS.
- [ ] **Step 4: Build the page.** Lay it out as the spec's section 3 (option C), using
      the post editor's `ResizablePanels`. The main panel has id `event-editor-main` and
      `defaultSize={70}`. The side panel has id `event-side-panel`, `defaultSize={30}`,
      `minSize={260}` and `maxSize={560}`, and the toolbar toggle hides it on `lg+`. Below
      `lg` the panels stack, as the post editor's do.
  - **Main column (`event-main.tsx`), in order:**
    - Cover: `ImageField`, `shape="wide"`, bound to `heroMediaId`, label "Cover photo".
    - Title.
    - Summary.
    - Description: `RichTextField`.
    - "Sessions": the time zone select, `EventDatesField`, and for a new event
      `RepeatField` and the "also at" sessions. For a series date, the existing
      "One date of a repeating event…" note.
  - **Side panel (`event-side-panel.tsx`), in order:**
    1. **Bookings** (saved events only):
       - "{booked} / {capacity} booked", or "{booked} booked" with no capacity.
       - "{checkedIn} checked in".
       - A "Guest list" link to `?view=guests`.
    2. **Places and booking:** capacity, max per booking, bookings open, bookings close.
    3. **Publishing:** the Published switch and Publish later.
    4. **Location:** location, venue. The location still sets the zone until someone
       picks a zone themselves.
    5. **Gallery:** `ImageGalleryField` bound to `galleryMediaIds`, with
       `max={EVENT_PHOTO_LIMIT - 1}` and the description
       `` `Up to ${EVENT_PHOTO_LIMIT - 1}, after the cover.` ``.
    6. **Web address** (slug).
  - **Toolbar (`event-toolbar.tsx`):**
    - Back link to `/events`.
    - Status badge: use `dateStatus(event)` from `series-date-picker.tsx`, or "New" for a
      new event.
    - Series date picker (Task 4).
    - Panel toggle, Preview, then a submit button: "Create event" for a new event,
      "Save" for a saved one.
    - For a draft, a "Publish" button beside it. It sets `status: 'published'` and
      `publishAt: null`, then submits. This is the same change as the Published switch,
      which stays in the side panel beside Publish later.
    - Overflow menu with Cancel event and Delete.
  - **Behaviour:**
    - A cancelled event renders `CancelledEvent`.
    - The route component remounts `EventEditor` on save, as `routes/_app/posts/$postId.tsx`
      does with `version`.
    - `onSaved` on a new event navigates to `/events/$eventId` with `replace: true`.
    - After a delete, navigate to `/events`.
    - Unsaved changes reuse the post editor's "Leave without saving?" dialog, with the
      description "Your unsaved changes to this event will be lost.".
  - **Routes:**
    - `new.tsx`: `beforeLoad` redirects to `/events` without `events:manage`. Its loader
      is `getEventLocations`, and its head title is "New event | Living Legacy CMS".
    - `$eventId.tsx`: `validateSearch` is `{ view: z.enum(['details','guests','dashboard']).optional().catch(undefined) }`.
      Its loader is `getEventPage`, and its head title is "{title} | Living Legacy CMS".
      When the loader returns null, show an `Empty` with "This event no longer exists" and
      a button back to Events.
- [ ] **Step 5: Verify:** `bun run type-check && bun run lint`, then `bun run dev:cms`.
      At `/events/new`, create a single event and confirm the page moves to its address.
      Edit the title, click Events, and confirm the leave dialog shows.
- [ ] **Step 6: Commit** `feat(cms): events open on their own page, laid out like a post`.

### Task 4: Guests, Dashboard and a series' dates on the page

**Files:**

- Modify: `apps/cms/src/components/events/editor/event-editor.tsx`
- Modify: `apps/cms/src/components/events/editor/event-toolbar.tsx`
- Modify: `apps/cms/src/routes/_app/events/$eventId.tsx`

**Interfaces:**

- Consumes: `EventGuests({ event })`, `EventDashboardPanel({ eventId, date, onDateChange, onOpenGuests })`,
  `SeriesDatePicker({ compact, event, dates, allDates, onPick })`, all unchanged.
- Produces: `?view=` drives the view. `details` is the default and is dropped from the
  address.

- [ ] **Step 1: Add Details / Guests / Dashboard `Tabs`** to the toolbar for saved
      events. Switching tabs navigates with `search: { view }`, `replace: true`.
  - Guests and Dashboard render full width in place of the panels.
  - The Bookings card's "Guest list" link and the dashboard's `onOpenGuests` both switch
    to `guests`.
- [ ] **Step 2: Wire the series date picker.** For `dates.length > 1`, the toolbar shows
      `SeriesDatePicker`. Picking a date navigates to `/events/$eventId` for that id and keeps
      `view`. That navigation goes through the unsaved-changes blocker.
  - On Dashboard, "all dates" keeps today's `allDates` behaviour, held in local state.
  - For a single date, show the status badge in the picker's place.
- [ ] **Step 3: Verify** in `bun run dev:cms` on a repeating event:
  - Move between dates on each tab.
  - Check in a guest and see the Bookings card count change after returning to Details.
  - Export CSV.
  - Open the scanner on a 390px touch viewport.
- [ ] **Step 4: Commit** `feat(cms): guests and dashboard as views of the event page`.

### Task 5: The list opens the page; remove the pane and the old form

**Files:**

- Modify: `apps/cms/src/components/events/events-page.tsx`
- Modify: `apps/cms/src/routes/_app/events/index.tsx`
- Create: `apps/cms/src/routes/_app/events/legacy-link.ts`
- Test: `apps/cms/src/routes/_app/events/legacy-link.test.ts`
- Modify: `apps/cms/src/components/checks/content-checks-page.tsx:264`,
  `apps/cms/src/components/shell/notifications.tsx:207`,
  `apps/cms/src/server/search-replace-store.ts:125`
- Delete: `apps/cms/src/components/events/event-form.tsx` (everything still used has
  moved in Tasks 2 and 3)

**Interfaces:**

- Produces: `legacyEventRedirect(search: { open?: string; view?: 'details' | 'guests' | 'dashboard' }): { to: '/events/$eventId'; params: { eventId: string }; search: { view?: … } } | null`

- [ ] **Step 1: Write the failing test.**
  - `legacyEventRedirect({ open: 'abc', view: 'guests' })` equals
    `{ to: '/events/$eventId', params: { eventId: 'abc' }, search: { view: 'guests' } }`.
  - With only `open: 'abc'`, `search` is `{}`.
  - `legacyEventRedirect({})` is null.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- legacy-link` and expect FAIL.
      Implement it, then run again and expect PASS.
- [ ] **Step 3: Redirect old links.** The index route's `beforeLoad` throws
      `redirect(legacyEventRedirect(search))` when the result is not null. `EventsPage` loses
      its `initialOpen` / `initialView` / `onOpenedInitial` props.
- [ ] **Step 4: Point the three linkers at the new route.**
  - Content checks and notifications: `<Link to="/events/$eventId" params={{ eventId }}>`.
  - Search-replace: the link string `/events/${r.id}`.
- [ ] **Step 5: Strip the pane from the list.**
  - Rows and cards navigate to `/events/$eventId` with `row.lead.id`. Use a `Link` or
    `navigate` in `onOpen`.
  - "New event" (the button and the `PageActions` add) navigates to `/events/new`.
  - Remove `useListPane`, `PaneColumn`, `PaneFrame`, `ListDialog`, `EventPanel`, the
    `PanelRightIcon` toggle, `emptyPaneOpen` and `lastPane`. `ListPageLayout` becomes a
    single full-width column.
  - Pass `wide` to `EventSummary`, and keep the row charts.
  - Delete `event-form.tsx`, and remove any import that still points at it.
- [ ] **Step 6: Verify:**
  - `bun run type-check && bun run lint && bun run --filter @ll/cms test:unit`.
  - In the browser, open an event from Content checks and from a notification. Confirm
    `/events?open=<id>&view=guests` lands on the Guests tab.
- [ ] **Step 7: Commit** `feat(cms): the events list opens each event's page`.

### Task 6: What's new, CI and checks on a phone

**Files:**

- Modify: `apps/cms/src/lib/whats-new.ts` (new entry at the top; add `'/events'` to the
  `link.to` union if missing)

- [ ] **Step 1: Add the What's new entry** at the top of `whatsNew`:
  - `id`: `2026-11-16`, or today's date at ship time with a `-N` suffix if one exists.
  - Entry title: "Events have their own page".
  - Item title: "More room for an event".
  - Body: "Opening an event, or making a new one, now takes you to its own page, like a
    post: the description in the middle, and bookings, places and dates at the side.
    Guests and the dashboard are tabs at the top."
  - Link: `{ label: 'Open Events', to: '/events' }`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- whats-new`. Expect PASS.
- [ ] **Step 3: Run CI locally** from the repo root:
      `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build`.
      Expect every step to pass.
- [ ] **Step 4: Browser checks.** Do these on desktop, and again at 390px with touch
      emulation:
  - Create a single event, then publish it.
  - Create a weekly repeating event with an extra session. Expect the toast to say
    "N sessions created".
  - Edit one date with "This date only", then edit another with "This and upcoming
    dates".
  - Schedule a publish.
  - Cancel an event, and confirm the page goes read-only.
  - Delete an event, and confirm it lands on Events.
  - Preview.
  - On Guests, add, check in and export.
  - Edit, then leave without saving; confirm the warning.
  - Open a stale event id, and confirm the empty state shows.
  - On a phone, confirm there is no tab bar on the editor and the back button reads
    "Events".
- [ ] **Step 5: Commit** `feat(cms): what's new for the event page`.

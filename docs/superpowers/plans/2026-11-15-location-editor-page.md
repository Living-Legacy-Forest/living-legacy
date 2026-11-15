# Location editor page: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Locations are added and edited on their own full page (`/locations/new`,
`/locations/$locationId`), laid out like the event page, in place of the list's edit pane, the
phone dialog and the four-step form.

**Architecture:** The form's rules move into pure, tested helpers (`location-values.ts`) and a
`useLocationEditor` hook. The page composes a main column and a collapsible side panel in the
`ResizablePanels` the event page uses. The list keeps its map and quick-view sheet; Add, the
sheet's Edit, the row menu's Edit and a double click or phone tap navigate to the pages, and the
pane, dialog and old form are deleted.

**Tech Stack:** TanStack Start + Router, React, shadcn on Base UI, Tailwind 4, Drizzle on D1,
Vitest (unit: plain Node; integration: local D1).

**Spec:** `docs/superpowers/specs/2026-11-15-location-editor-page-design.md`. The finished event
page is the model: `apps/cms/src/components/events/editor/` and
`docs/superpowers/plans/2026-11-15-event-editor-page.md`. Read `event-editor.tsx`,
`use-event-editor.ts` and `event-toolbar.tsx` first and mirror them.

## Global Constraints

- No database schema or migration changes, no new fields. `saveLocation` may additionally return
  the slug it stored (Task 3); what it saves does not change.
- Permission for both new routes: `content:write` (redirect to `/locations` without it). Viewers
  keep the list, map and sheet and see no edit controls.
- Mutations through `useAction()`; loading uses `Spinner`; icons from `@/components/icons`;
  validation errors are Sonner toasts on submit (`reportInvalid`, `notify.error`), never inline.
- Fields match the other forms: standard `Input`/`Textarea`/`Select` inside `FormCell`; optional
  numbers use `className="w-28"`; no custom sizes. Toolbar buttons are `size="sm"` with icons
  (`SendIcon` Publish, `SaveIcon` Save, `PlusIcon` Add location).
- Copy is plain, sentence case, Australian English. Keep the existing strings of moved code word
  for word unless this plan gives new ones.
- Touch: controls at least 44pt (`touch:min-h-11`), nothing reachable only by hover; check at
  390px with touch emulation.
- `RichTextField` for About, with `contentClassName="[&_.ProseMirror]:min-h-80!"`.
- Commits are Conventional Commits (`feat(cms): …`), header at most 100 characters, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Format what you touch: `bunx prettier --write <paths>`.

## Review Focus

1. **Slug:** follows the name until someone edits it; on blur it settles to `slugify(slug || name)`;
   after a save it shows the slug the server stored (a taken slug becomes `town-2`). Tests: Task 2
   `withName`, `settledSlug`.
2. **A new location's order** is one after the last, and an empty directory starts at 1. Test: Task 2
   `nextSortOrder`.
3. **Leaving with unsaved edits** (back, sidebar, tab close) warns; Save, Add and Delete do not; a
   saved page stays as it is (scroll, cursor, panel width). Test: Task 2 `isLocationDirty`.
4. **A viewer or a stale id:** `/locations/<id>` without `content:write` redirects to the list; an id
   that no longer exists shows an empty state, not a crash. Browser check in Task 5.
5. **Delete** leaves for the list before the data refreshes (no "no longer exists" flash). Browser
   check in Task 5.

---

### Task 1: Shared editor pieces and navigation

**Files:**

- Create: `apps/cms/src/components/editor-page/use-is-desktop.ts`
- Create: `apps/cms/src/components/editor-page/leave-dialog.tsx`
- Modify: `apps/cms/src/components/events/editor/event-editor.tsx` (use both; behaviour unchanged)
- Modify: `apps/cms/src/lib/nav.ts` (`isEditorPath`, `editorBack`)
- Test: `apps/cms/src/lib/nav.test.ts`

**Interfaces:**

- Produces:
  - `useIsDesktop(): boolean` (the event page's hook, moved: `(min-width: 1024px)`, `true` on the
    server).
  - `LeaveDialog({ blocker, what }: { blocker: { status: string; proceed?: () => void; reset?: () => void }; what: string })`
    renders the existing "Leave without saving?" alert, open when `blocker.status === 'blocked'`,
    description `` `Your unsaved changes to this ${what} will be lost.` ``.
  - `isEditorPath` is true for `/locations/new` and `/locations/<id>`, false for `/locations`.
  - `editorBack('/locations/<id>')` equals `{ to: '/locations', label: 'Locations' }`.

- [ ] **Step 1: Write the failing tests** in `nav.test.ts`: `isEditorPath('/locations/01J0ABC')` and
      `isEditorPath('/locations/new')` are true, `isEditorPath('/locations')` is false;
      `editorBack('/locations/01J0ABC')` equals `{ to: '/locations', label: 'Locations' }` (events and
      posts cases unchanged); `findNavItem('/locations/01J0ABC')?.title` is `'Locations'`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- nav`; expect FAIL.
- [ ] **Step 3: Implement** the two `nav.ts` changes (extend the editor-path pattern, branch
      `editorBack` on `/events/`, `/locations/`, else posts). Run the test; expect PASS.
- [ ] **Step 4: Extract** `useIsDesktop` and `LeaveDialog` from `event-editor.tsx` into the new files
      and use them there. Run `bun run type-check && bun run lint`.
- [ ] **Step 5: Commit** `refactor(cms): editor page pieces the location page will share`.

### Task 2: Pure location rules

**Files:**

- Create: `apps/cms/src/components/locations/editor/location-values.ts`
- Test: `apps/cms/src/components/locations/editor/location-values.test.ts`
- Modify: `apps/cms/src/server/locations.ts` (export `type LocationInput = z.input<typeof locationSchema>`)

**Interfaces:**

- Produces (the form's rules, moved out of `LocationForm` in `locations-page.tsx`):
  - `type LocationValues = { name: string; slug: string; state: AustralianState; region: string; stage: LocationStage; externalUrl: string; heroMediaId: string | null; intro: string; about: RichTextDoc | null; address: string; pin: Pin | null; mapUrl: string; hours: string; phone: string; email: string; hubspotFormId: string; sortOrder: string; published: boolean }`
  - `pinOf(l: { latitude: number | null; longitude: number | null }): Pin | null` (moved from
    `locations-page.tsx`, which then imports it)
  - `initialLocationValues(item: LocationItem | null, nextOrder: number): LocationValues`
  - `nextSortOrder(items: { sortOrder: number }[]): number`
  - `withName(values: LocationValues, name: string, slugTouched: boolean): LocationValues`
  - `settledSlug(slug: string, name: string): string`
  - `toLocationInput(values: LocationValues, id?: string): LocationInput`
  - `isLocationDirty(values: LocationValues, saved: LocationValues): boolean`

- [ ] **Step 1: Write the failing tests:**
  - `initialLocationValues(null, 4)` has `state: 'QLD'`, `stage: 'coming_soon'`, `sortOrder: '4'`,
    `published: true`, empty strings and a null pin; for an item with `status: 'draft'`,
    `latitude`/`longitude` set, `published` is false and `pin` is `{ latitude, longitude }`; an item
    with a null latitude has `pin: null`.
  - `nextSortOrder([])` is 1; `nextSortOrder([{sortOrder: 2}, {sortOrder: 9}])` is 10.
  - `withName(v, 'Wellington Dam', false).slug` is `'wellington-dam'`; with `slugTouched: true` the
    slug is left as it was.
  - `settledSlug('', 'Mount Gambier')` is `'mount-gambier'`; `settledSlug('My  Slug!', 'x')` is
    `'my-slug'`.
  - `toLocationInput` returns `sortOrder` as a number (`'7'` to 7, `''` to 0), `status: 'draft'` when
    `published` is false, `pin` passed through, and `id` only when given.
  - `isLocationDirty(v, v)` is false and true after changing `name`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- location-values`; expect FAIL.
- [ ] **Step 3: Implement** the functions in `location-values.ts` (`slugify` from `@ll/content`;
      `isLocationDirty` compares `JSON.stringify`). Export `LocationInput` from `server/locations.ts`.
      Make `locations-page.tsx` import `pinOf` from the new file and delete its copy.
- [ ] **Step 4: Run** the unit test (PASS), then `bun run type-check && bun run lint`.
- [ ] **Step 5: Commit** `refactor(cms): location form rules as pure, tested helpers`.

### Task 3: The location page and its routes

**Files:**

- Create: `apps/cms/src/components/locations/editor/use-location-editor.ts`
- Create: `apps/cms/src/components/locations/editor/location-main.tsx`
- Create: `apps/cms/src/components/locations/editor/location-side-panel.tsx`
- Create: `apps/cms/src/components/locations/editor/location-toolbar.tsx`
- Create: `apps/cms/src/components/locations/editor/location-editor.tsx`
- Create: `apps/cms/src/components/locations/delete-location.tsx` (`DeleteLocationDialog` controlled;
  `DeleteLocation` icon button moved here from `locations-page.tsx`, built on the dialog)
- Create: `apps/cms/src/routes/_app/locations/new.tsx`, `apps/cms/src/routes/_app/locations/$locationId.tsx`
- Modify: `apps/cms/src/server/locations.ts` (`saveLocation` also returns `slug`), `apps/cms/src/routeTree.gen.ts` (regenerate)

**Interfaces:**

- Consumes: Task 1 `useIsDesktop`, `LeaveDialog`, `editorBack`; Task 2 helpers and `LocationValues`.
- Produces:
  - `saveLocation` resolves `{ id: string; slug: string }` (the stored slug) in both branches.
  - `useLocationEditor({ item, nextOrder, onSaved }: { item: LocationItem | null; nextOrder: number; onSaved: (id: string) => void })`
    returns `{ values, patch, setName, setSlug, settleSlug, dirty, pending, submit, publish, skipBlock, blocker, heroUrl }`.
    `setName`/`setSlug` keep the slug-follows-name rule (a `slugTouched` flag starts true for a saved
    location). `submit(e)` runs `reportInvalid(form)` then saves; `publish(form)` does the same with
    `published: true`. Saving a saved location resets the saved snapshot to what was sent and sets
    `values.slug` to the returned slug, without remounting; saving a new one calls `skipBlock()` then
    `onSaved(id)`. The blocker is `useBlocker({ shouldBlockFn: () => dirtyRef.current && !skipRef.current, enableBeforeUnload, withResolver: true })`
    as in `use-event-editor.ts`.
  - `LocationEditor({ item, nextOrder, reveal }: { item: LocationItem | null; nextOrder: number; reveal?: boolean })`.
  - `DeleteLocationDialog({ item, open, onOpenChange, onConfirm }: { item: LocationItem; open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void | Promise<void> })`.

- [ ] **Step 1: Server:** make both branches of `saveLocation` return `{ id, slug: values.slug }`.
- [ ] **Step 2: Build the editor** mirroring the event page:
  - **Layout:** `ResizablePanels` with ids `location-editor-main` (`defaultSize` 70, `minSize` 420) and
    `location-side-panel` (`defaultSize` 30, `minSize` 260, `maxSize` 560, `collapsible`,
    `collapsed={!showSide && desktop}`, `onCollapsedChange={(h) => setShowSide(!h)}`); the main card
    has the same margin transition as `event-editor.tsx`. Everything sits in a `<form noValidate>`.
  - **Main column:** hero photo (`ImageField` id `loc-hero`, keep its description), name (hint
    unchanged), intro (`Textarea`, `rows={4}`, `maxLength={400}`), About (`FormBlock` + `RichTextField`,
    hint unchanged), address, map pin (`FormBlock` + `PinPicker`, `photoUrl={heroUrl}`).
  - **Side panel sections, in order:** Publishing (Published switch, description "Show this on the
    website."); Listing (stage with its `stageHints`, and Current website when the stage is
    `external`); Place (state, region; footer text kept); Visiting (map link, hours, phone, email);
    On the website (slug, with its hint and blur behaviour); Other (HubSpot form ID, Order
    `className="w-28"`). Every field id, hint, placeholder and limit is copied from the old form.
  - **Toolbar:** back link to `/locations` (hidden on phones), badge (Published, Draft, or New),
    "Unsaved changes", panel toggle, overflow menu with Delete (saved only), Publish (when a draft,
    outline), then Save (`SaveIcon`) or Add location (`PlusIcon`), all `size="sm"`.
  - **Delete:** `DeleteLocationDialog` from the menu; on confirm run `deleteLocations` through
    `useAction` with `afterAction` navigating to `/locations` (after `skipBlock()`).
  - `<h1 className="sr-only">`; `LeaveDialog what="location"`.
- [ ] **Step 3: Routes.** `new.tsx` and `$locationId.tsx` both have
      `beforeLoad: ({ context }) => { if (!can(context.user.role, 'content:write')) throw redirect({ to: '/locations' }) }`.
      `new.tsx`: loader `async () => ({ nextOrder: nextSortOrder(await listLocations()) })`, head title
      "Add location | Living Legacy CMS". `$locationId.tsx`: loader finds the item in `listLocations()`
      and returns `{ item: LocationItem | null; nextOrder: number }`; head title is the name or
      "Location | Living Legacy CMS"; a null item renders an `Empty` ("This location no longer
      exists", button back to Locations). After a first save, `onSaved` navigates to
      `/locations/$locationId` with `replace: true`. Regenerate `routeTree.gen.ts` (it is regenerated by
      `vite dev`/`vite build`, or run the router generator) and commit it.
- [ ] **Step 4: Verify** `bun run type-check && bun run lint && bun run --filter @ll/cms test:unit`.
- [ ] **Step 5: Commit** `feat(cms): locations open on their own page, laid out like an event`.

### Task 4: The list opens the pages; remove the pane, dialog and old form

**Files:**

- Modify: `apps/cms/src/components/locations/locations-page.tsx`

**Interfaces:**

- Consumes: Task 3 routes (`/locations/new`, `/locations/$locationId`), `DeleteLocation`
  (now in `delete-location.tsx`).

- [ ] **Step 1: Navigation.** Add `const go = useNavigate()` (the existing `navigate` is bound to the
      list for `?selected=` and stays). Define `openEdit = (id: string) => go({ to: '/locations/$locationId', params: { locationId: id } })`
      and `openNew = () => go({ to: '/locations/new' })`. Use them for: the Add location buttons and the
      phone `PageActions` add; the sheet's `onEdit`; `editMenuItems(canWrite, () => openEdit(l.id))` (all
      screen sizes, not only desktop); `onDoubleClick`; and the phone tap (`isDesktop() ? select(l.id) : canWrite && openEdit(l.id)`).
- [ ] **Step 2: Remove** `Target`, `useListPane`, `view`, `pane`, `paneItem`, `dialogItem`,
      `locationForm`, `nextOrder`, `LocationForm` (all of it), `PaneColumn`/`PaneFrame`/`PaneActions`/`DialogActions`/`ListDialog`
      and the step/form imports that become unused. `current` on rows and cards becomes
      `l.id === selectedId`; `select` no longer closes a pane; the sheet is open when
      `sheetOpen && selected !== null`; the empty state is `data.length === 0`; the right-hand area is
      the map only.
- [ ] **Step 3: Verify** `bun run type-check && bun run lint && bun run --filter @ll/cms test`;
      confirm no unused exports remain (`DeleteLocation` is imported from its new file).
- [ ] **Step 4: Commit** `feat(cms): the locations list opens each location's page`.

### Task 5: What's new, CI and checks on a phone

**Files:**

- Modify: `apps/cms/src/lib/whats-new.ts` (new entry at the top; add `'/locations'` to the `link.to`
  union if missing)

- [ ] **Step 1: Add the What's new entry.** `id` is today's date with the next free `-N` suffix;
      title "Locations have their own page"; item "More room for a location": "Adding or editing a
      location now takes you to its own page, with About and the map pin in the middle and publishing,
      listing and visiting details at the side. The map and quick view on the list work as before."
      Link `{ label: 'Open Locations', to: '/locations' }`. Run `bun run --filter @ll/cms test:unit -- whats-new`.
- [ ] **Step 2: Run CI** from the repo root, one step at a time (the root `type-check` needs the
      website's `@astrojs/check`, which may be missing locally; say so if it is):
      `bun run --filter @ll/cms type-check`, `bun run lint`, `bun run format:check`, `bun run test`,
      `bun run build`. Expect every step to pass.
- [ ] **Step 3: Browser checks**, desktop and 390px with touch emulation, if a signed-in session is
      available (sign-in is a magic link; if you cannot sign in, say the checks were not run): add a
      location (name, slug follows, pin, publish); edit one and Save (page keeps its scroll); change
      stage to external; the leave warning; the side panel toggle; Delete (lands on the list with no
      flash); a stale `/locations/<id>`; double click and phone tap open the page, a single click on
      desktop still opens the sheet; as a viewer, no edit controls and `/locations/new` redirects.
- [ ] **Step 4: Commit** `feat(cms): what's new for the location page`.

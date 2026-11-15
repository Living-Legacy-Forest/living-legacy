# Location editor as a full page: design

Date: 2026-11-15
Status: draft, awaiting approval

Same change as the event page (#206, `docs/superpowers/specs/2026-11-15-event-editor-page-design.md`),
for locations.

## 1. Intent

Locations are added and edited in a right-hand pane (a dialog on phones), and a new one is
made in four steps (Details, Content, Visit, Publish). The form is long: name, slug, state,
region, stage, current website, hero photo, intro, a rich-text About, address, a map pin
picker, map link, hours, phone, email, HubSpot form ID, order and a Published switch. Events
and posts now have full-page editors that editors find more comfortable; give locations the
same, so a location is planned in one roomy place and the form no longer fights the list for
space.

**Success looks like**

- Adding or editing a location happens on its own page, with About and the map pin given real
  room.
- Everything the pane and the four steps could do still works.
- The list keeps what makes it useful: the map of every location and the quick-view sheet.
- It is comfortable at 390px on a touch screen.

## 2. Goals, non-goals, anti-goals

**Goals**

- Routes `/locations/new` and `/locations/$locationId`, replacing the edit pane, the phone
  dialog and the step form.
- The events page's shape: a main column for the story and a side panel for the rest, with
  the panel gliding open and shut, and the same warning before leaving with unsaved changes.
- Keep every field and rule (slug follows the name until edited, stage hints, pin picker,
  published switch, server-side unique slug).

**Non-goals**

- No database or migration changes, no new fields, no change to what `saveLocation`,
  `deleteLocations` or `setLocationStatus` do.
- No change to the map, the quick-view sheet, filters, grid/list views or the row menu beyond
  where Edit and Add lead.
- No change to the events page.

**Anti-goals**

- Making viewers (no `content:write`) worse off: they keep the list, map and sheet and never
  see edit controls.
- Two ways to edit a location that drift apart (leaving the old pane form alive).
- Losing unsaved work on leaving without a warning.

## 3. The page

**Top bar:** back to Locations, a status badge (Published, Draft, or New), then Save (Add
location on a new one) and Publish for a draft; Delete in the overflow menu. Buttons are the
small size, with icons, as on the event page.

**Main column, top to bottom:** hero photo; name; intro; the rich-text About (tall, like the
event description); address; the map pin picker.

**Side panel** (collapsible from `lg`, stacks under below it), in this order:

1. **Publishing:** the Published switch.
2. **Listing:** stage (with its hint) and, for an external stage, the current website.
3. **Place:** state and region.
4. **Visiting:** map link, hours, phone, email.
5. **On the website:** slug (follows the name until edited).
6. **Other:** HubSpot form ID, order.

**New location:** `/locations/new` is the same layout with empty fields; Save creates it and
moves to its page. The next order and the published-by-default behave as today.

**Unsaved changes:** leaving with edits asks first; saving keeps the page as it is.

## 4. The list

- **Add location** (button and phone action) opens `/locations/new`.
- **A row** still selects the location (pans the map, opens the quick-view sheet), as today;
  `?selected=<id>` keeps working, so the dashboard map and Media's "used by" links need no
  change.
- **Edit** in the sheet and in the row menu opens `/locations/<id>`. The row menu's Edit,
  today desktop-only, shows on every screen size to people who can write, as the page works
  everywhere.
- The edit pane, the phone dialog and the old form are removed. The right-hand area is the map
  alone.

## 5. Constraints

- Follow `AGENTS.md`: `useAction()`, `Spinner`, icons from `@/components/icons`, validation
  as Sonner toasts, sentence-case Australian English, 44pt touch targets, check at 390px.
- Both new routes need `content:write` (redirect to `/locations` without it). The loader for
  an existing location needs only to find it in the same list data (`listLocations`), or a
  `getLocationPage` read if cleaner.
- Add a What's new entry.

## 6. My calls

- **Row click stays select-and-sheet**, with Edit leading to the page (the owner chose this
  option in conversation; "yes" to the either/or, recorded as my call).
- **Delete** moves from the form's last step into the page's menu, with the existing confirm.
- **Shared pieces:** the events editor's panel-collapse wiring, `useIsDesktop` and
  leave-without-saving dialog are generic. Extract them to shared files only if it is small and
  leaves the event page unchanged; otherwise copy and note it.

## 7. Left to the builder

- The exact grouping inside the side panel and the phone arrangement.
- Whether the pin picker sits in the main column or as the first thing in the side panel,
  depending on how it looks with the narrow panel.

## 8. Testing

- Existing unit and integration tests keep passing; no server rules change.
- Unit tests for any new pure logic.
- Browser checks, desktop and 390px with touch emulation: add a location, edit one, change
  stage, set a pin, publish and unpublish, delete, the leave warning, the side panel toggle,
  and as a viewer (no edit controls). Run what CI runs.

# CMS phone UI, native iOS style: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every CMS screen below 768px looks and behaves like a UIKit app. Desktop and tablet do
not change.

**Architecture:**

- **Phone looks come from shared components, using `max-md:` CSS.** List parts, shell, form cells,
  dialogs and confirmations carry the styling, so pages get it by using them. This avoids
  rendering different trees per device and the hydration mismatches that come with it.
- **JavaScript is used only where structure differs:**
  - page actions portalled into the top bar;
  - the sheet's Cancel/Save portalled into the sheet header;
  - the toast position.
- **Pages then adopt the shared parts one at a time.**

**Tech stack:**

- TanStack Start, React 19, shadcn on Base UI, Tailwind 4 (`max-md:`, and the custom `touch:`
  variant);
- Sonner 2, for toasts;
- Chrome DevTools MCP, to check screens at 390×844 with mobile touch emulation.

**Spec:** `docs/superpowers/specs/2026-11-08-ios-mobile-ui-design.md`. Read it first, including
"Calls made after review".

## Global constraints

- **Phone means below `md` (768px)**, the same width that `useIsMobile()` and the tab bar use. The
  768 to 1023px range and anything 1024px or wider must look exactly as before.
- **iOS tokens are phone-only**, declared under `@media (max-width: 767px)` in `styles.css` for both
  `:root` and `.dark`:

  | Token                                      | Light                     | Dark                      |
  | ------------------------------------------ | ------------------------- | ------------------------- |
  | `--ios-grouped`                            | `#f2f2f7`                 | `#000000`                 |
  | `--ios-cell`                               | `#ffffff`                 | `#1c1c1e`                 |
  | `--ios-cell-raised` (cells inside a sheet) | `#ffffff`                 | `#2c2c2e`                 |
  | `--ios-separator`                          | `rgb(60 60 67 / 0.29)`    | `rgb(84 84 88 / 0.65)`    |
  | `--ios-secondary`                          | `rgb(60 60 67 / 0.6)`     | `rgb(235 235 245 / 0.6)`  |
  | `--ios-fill`                               | `rgb(118 118 128 / 0.12)` | `rgb(118 118 128 / 0.24)` |
  | `--ios-segment-on`                         | `#ffffff`                 | `#636366`                 |

  The tint is the existing `--brand`. Destructive stays `--destructive`.

- **iOS type scale** on phones (spec): large title 34px bold; body 17px; secondary 15px; group
  headings 13px uppercase in `--ios-secondary`.
  - The large title is already 34px on phones (`styles.css`, `[data-slot='page-title']`), and it
    already collapses into the top bar (`useLargeTitle`). Keep both, and make sure every page has
    a `data-slot="page-title"` heading.
- **Interaction:**
  - every tappable row or button is at least 44px (`min-h-11`);
  - nothing is reachable only by hover;
  - respect `prefers-reduced-motion`.
- **Copy:** plain, sentence case, Australian English. Form errors are toasts on submit, never
  inline.
- **Repo rules:**
  - Edit `components/ui/*` only where a task says so, and keep the edit small. Prefer wrapping.
  - Do not touch `components/editor`, `components/extensions` or `components/templates`.
- **Every task's check**, in Chrome MCP:
  - screenshot the affected pages at **390×844, mobile and touch**, in light **and** dark;
  - screenshot at **1280×800** and confirm desktop is unchanged;
  - run `bun run type-check`, `bun run lint` and `bunx prettier --check apps packages`.
  - The CMS has no component test runner. These screenshots plus the named checks are the tests.
    Save screenshots under `.playwright-mcp/` (git-ignored).

## Review focus

Things the spec implies but no feature test naturally covers. Each has a check in the task that
owns it.

1. **Keyboard open in a sheet.** Typing in a field near the bottom keeps Save (in the sheet's top
   bar) visible and tappable, and the field scrolls into view. _(Task 6)_
2. **Swiping down on a sheet.** With typed changes it asks "Discard changes?". Unchanged, it closes
   at once. Cancel behaves the same. _(Task 6)_
3. **Long names.** A 60-character location name or post title truncates with an ellipsis in the top
   bar, the sheet title and rows, with no horizontal scroll. _(Tasks 2, 3, 6)_
4. **Desktop and tablet are unchanged** at 800px and 1280px: dialog footers, panes, the sidebar and
   toasts at the bottom right. _(every task; full sweep in Task 12)_
5. **Light mode.** Grouped colours, separators and the green tint stay readable in light mode, not
   just in the dark mock-ups. _(Tasks 1, 12)_

---

### Task 1: Phone tokens and grouped page background

**Files:**

- Modify: `apps/cms/src/styles.css`. Add the token block from Global constraints.
- Modify: `apps/cms/src/components/shell/app-shell.tsx`. On phones the main content area uses
  `--ios-grouped` as its background.

**Interfaces:**

- **Produces:** the CSS variables `--ios-grouped`, `--ios-cell`, `--ios-cell-raised`,
  `--ios-separator`, `--ios-secondary`, `--ios-fill` and `--ios-segment-on`, defined on phones only.
  Every later task uses them as `max-md:bg-(--ios-cell)` and so on.

- [ ] **Step 1:** Add the token block, under one `@media (max-width: 767px)`, for `:root` and
      `.dark`, with the exact values above.
- [ ] **Step 2:** Give the phone main area a `--ios-grouped` background. The tab bar and header keep
      their translucent backgrounds.
- [ ] **Step 3: Check.**
  - At 390×844, the Dashboard background is `#f2f2f7` in light and `#000` in dark (use
    `evaluate_script` and `getComputedStyle`).
  - At 1280, the background is the same `--background` as before.
- [ ] **Step 4: Commit** with the message `feat(cms): iOS colour tokens for phones`.

### Task 2: Top bar: page actions, bell, no initials

**Files:**

- Create: `apps/cms/src/components/shell/page-actions.tsx`.
- Modify: `apps/cms/src/components/shell/app-header.tsx`.
- Modify: `apps/cms/src/components/shell/nav-user.tsx`, to hide it on phones only.

**Interfaces:**

- **Produces:**
  ```tsx
  export function PageActions(props: {
    /** Left of the top bar: Edit/Done for pages with Edit mode. */
    edit?: { editing: boolean; onToggle: () => void };
    /** The + button. A single action, or a menu when there are several. */
    add?: { label: string; onClick: () => void } | { label: string; items: PageMenuItem[] };
    /** The … menu, for anything else (e.g. Bulk update). */
    more?: PageMenuItem[];
  }): JSX.Element | null;
  export type PageMenuItem = { label: string; onClick: () => void; destructive?: boolean };
  ```
- **How it renders:**
  - It renders on phones only, using `useIsMobile()`.
  - It portals into two slots that `AppHeader` renders with `data-slot="page-actions-start"` and
    `data-slot="page-actions-end"`.
  - **+** and **…** are 44px tint-coloured icon buttons. A menu opens as an action sheet (the
    phone `DropdownMenu` or `AlertDialog` drawer).
  - Edit and Done are 17px tint-coloured text.
- **Page rule:** pages keep their desktop buttons with `max-md:hidden` added, and also render
  `<PageActions>`.

- [ ] **Step 1:** Build `PageActions` and the two slots.
  - Left slot: Edit, or the existing back link when the page has one. The back link wins; Edit
    then goes to the right, before +.
  - Right slot: page actions, then the bell.
- [ ] **Step 2:** Hide `NavUser` below `md`. The account lives in More (Task 3).
- [ ] **Step 3:** Put `<PageActions add={…} />` on Locations, as the first consumer, to prove the
      slots work. Hide its "Add location" button on phones.
- [ ] **Step 4: Check.**
  - At 390, Locations shows the bell and + top right, and no initials. Tapping + opens New location.
  - At 1280, the header is unchanged: breadcrumbs, bell and initials.
  - Review focus 3: in a 390 screenshot of a long title collapsed into the top bar, the title
    truncates between the left and right actions.
- [ ] **Step 5: Commit** with the message `feat(cms): phone top bar takes page actions`.

### Task 3: Grouped lists

**Files:**

- Modify: `apps/cms/src/components/list/list-page.tsx`: `ListPageLayout`, `ListColumn`,
  `ListRows`, `NoMatches`.
- Modify: `apps/cms/src/components/list/list-row.tsx`.
- Modify: `apps/cms/src/components/list/list-tools.tsx`: `SelectionBar` and `SearchInput`.

**Interfaces:**

- **Produces:** `ListRows` gains `inset?: 'text' | 'media'`.
  - It sets where separators start: 16px, or 16 + 60 + 12 = 88px past a 60px thumbnail.
  - The default is `'text'`.
- **Produces:** `SelectionBar` gains `editInTopBar?: boolean`, default `true`.
  - On phones, `SelectionBar` no longer shows Edit/Done itself. Pages pass
    `PageActions edit={{ editing: selection.selecting, onToggle: … }}` instead.
  - On phones, its count reads as an uppercase group heading above the group, for example
    "7 LOCATIONS", in `--ios-secondary` at 13px.
- **Consumes:** the tokens from Task 1 and `PageActions` from Task 2.

- [ ] **Step 1:** Phone styles.
  - `ListPageLayout`: no border, no `flex-1` stretch, not clipped.
  - `ListColumn`: no border.
  - `ListRows`: a rounded 10px group on `--ios-cell`, with 16px side margins, and height that fits
    its rows. Hairline `--ios-separator` dividers between rows, inset per `inset`.
  - `ListRow`:
    - no rounded hover background;
    - at least 44px tall;
    - 17px title and 15px secondary text;
    - the chevron in `--ios-secondary`;
    - pressed state `bg-(--ios-fill)`.
  - **Swipe-to-delete keeps working.**
- [ ] **Step 2:** `SearchInput` on phones:
  - full width;
  - a 10px radius with an `--ios-fill` background and no border;
  - 17px text;
  - the placeholder becomes "Search".
- [ ] **Step 3:** Move Edit into `PageActions` on Locations, Team and Events.
  - Locations passes `inset="media"`.
  - Remove the empty bordered box: the group must end at its last row.
- [ ] **Step 4: Check.**
  - At 390, Locations, Team and Events look alike: count heading, rounded group ending at the last
    row, and Edit in the top bar.
  - Swiping a row reveals Delete.
  - Edit mode shows tick boxes, and bulk Delete appears in the heading row.
  - Review focus 3: a long row title truncates.
  - At 1280, all three are unchanged.
- [ ] **Step 5: Commit** with the message `feat(cms): inset grouped lists on phones`.

### Task 4: Segmented control

**Files:**

- Create: `apps/cms/src/components/segmented-control.tsx`.
- Modify: `apps/cms/src/components/events/events-page.tsx`, the Upcoming/Drafts/Past/All filter.

**Interfaces:**

- **Produces:**
  ```tsx
  export function SegmentedControl<T extends string>(props: {
    label: string;
    value: T;
    onValueChange: (value: T) => void;
    options: { value: T; label: string }[]; // 2 to 4 options
    className?: string;
  }): JSX.Element;
  ```
- **Behaviour:**
  - It wraps the existing `ToggleGroup`, so desktop looks as Events does today.
  - On phones it is one `--ios-fill` track (9px radius) with an `--ios-segment-on` thumb.
  - Option labels are 13px, semibold when selected.
  - The control is 32px tall, and its tap area reaches 44px.
- **Rule:** use it only for filters with 2 to 4 options (spec). Longer filters stay pickers.

- [ ] **Step 1:** Build it, and use it for the Events filter.
- [ ] **Step 2:** Find every other `ToggleGroup` used as a filter with 2 to 4 options, using
      `rg "ToggleGroup" apps/cms/src/components`, and switch each to `SegmentedControl`.
  - This includes the event panel's Details/Guests switch.
  - Leave filters with 5 or more options alone.
- [ ] **Step 3: Check.**
  - At 390, Events shows one segmented control, and switching changes the list.
  - At 1280 and at 800, the Events filter looks as before.
- [ ] **Step 4: Commit** with the message `feat(cms): segmented control for short filters on phones`.

### Task 5: Messages from the top on phones

**Files:**

- Modify: `apps/cms/src/routes/__root.tsx`.
- Modify: `apps/cms/src/components/ui/sonner.tsx` (small edit: accept the phone props).

**Interfaces:**

- **Phones** (`useIsMobile()`):
  - `position="top-center"`;
  - `mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}`;
  - `swipeDirections={['top']}`;
  - toasts at most `calc(100vw - 20px)` wide, with a 16px radius.
- **Desktop:** keeps its current position and offset.
- **Durations:** errors keep their existing longer duration.

- [ ] **Step 1:** Make the Toaster's position breakpoint-aware, with the props above.
- [ ] **Step 2: Check.**
  - At 390, save something (for example, rename a team member). The banner slides down below the
    notch area and over the top bar, and a swipe up dismisses it.
  - Trigger two messages quickly: they stack.
  - At 1280, toasts appear where they did before.
- [ ] **Step 3: Commit** with the message `feat(cms): toasts drop from the top on phones`.

### Task 6: Sheet with Cancel/Save in its top bar, and the discard prompt

**Files:**

- Create: `apps/cms/src/components/list/sheet-form.tsx`.
- Modify: `apps/cms/src/components/list/list-page.tsx`: `ListDialog` and `DialogActions`.

**Interfaces:**

- **Produces**, from `sheet-form.tsx`:
  ```tsx
  /** The id the open sheet's <form> must carry, so Save in the sheet's top bar can submit it. */
  export function useSheetFormId(): string | undefined;
  /** For custom fields that do not fire native input or change events (switches, pickers). */
  export function useMarkSheetDirty(): () => void;
  ```
- **`ListDialog` on phones:**
  - a header row with **Cancel** (left, tint), the title (centre, 17px semibold, truncated) and a
    slot for the submit button (right);
  - the drag handle is kept;
  - the close (×) button is not shown;
  - the body is `--ios-grouped`, and cells inside use `--ios-cell-raised`.
- **`DialogActions` on phones:**
  - It portals its submit children into that header slot.
  - It clones the submit `Button` with `form={useSheetFormId()}`, and shows it as 17px semibold
    tint text.
  - The `start` content (for example Delete) renders at the bottom of the body as a full-width red
    row.
  - Desktop is unchanged.
- **Dirty tracking:**
  - `ListDialog` marks the sheet dirty on any native `input` or `change` event inside it, or on
    `useMarkSheetDirty()`.
  - Closing a dirty sheet (Cancel, swipe down, or backdrop) opens an action sheet: "Discard
    changes?", a red **Discard changes**, and **Keep editing**.
  - A clean sheet closes straight away.
  - After a successful save, the sheet closes without asking.
- **Multi-step forms:** the event form passes **Next** as its submit child until the last step, as
  its footer does today.

- [ ] **Step 1:** Build the context, header and portal.
  - Add `id={useSheetFormId()}` to each `<form>` that is rendered inside `ListDialog`. Find them
    with `rg "<form" apps/cms/src/components`. There are 19; add the id to each one shown in a
    `ListDialog`.
- [ ] **Step 2:** Build dirty tracking and the discard action sheet. It uses the `AlertDialog`
      phone variant from Task 7, or a plain one until Task 7 lands.
- [ ] **Step 3: Check, on Locations and Events.**
  - At 390, tapping a row opens a sheet with Cancel / title / Save. Save saves, and the sheet
    closes with a top toast.
  - Review focus 2:
    - type a character, then swipe down: "Discard changes?" appears;
    - choose Keep editing: the sheet stays with the text;
    - open the sheet again unchanged, then swipe down: it closes at once;
    - Cancel behaves the same way.
  - Review focus 1: in the event form, focus the last field on the last step with the on-screen
    keyboard emulated (`evaluate_script` to focus, then screenshot). Save stays visible at the top
    and tappable.
  - Review focus 3: a 60-character name truncates in the sheet title.
  - At 800 and 1280, dialogs and panes show their footer buttons as before.
- [ ] **Step 4: Commit** with the message
      `feat(cms): phone sheets with Cancel and Save on top, and a discard prompt`.

### Task 7: Confirmations as action sheets

**Files:**

- Modify: `apps/cms/src/components/ui/alert-dialog.tsx` (phone branch only).

**Interfaces:**

- **Phone layout:**
  - one rounded `--ios-cell-raised` group holding the title and description, centred, 13px, in
    `--ios-secondary`;
  - the action, a 57px row in 20px text (red when `variant="destructive"`, otherwise tint);
  - 8px of space, then a separate rounded group holding **Cancel**, in 20px semibold tint.
- **Applies to** every existing confirmation: delete, bulk delete, cancel event, and the scope
  choice (this date or upcoming dates).
- **Scope dialogs:** their two actions stack in the first group.

- [ ] **Step 1:** Restyle the phone branch to that layout. Desktop is unchanged.
- [ ] **Step 2: Check.**
  - At 390, delete a location, cancel an event and bulk-delete FAQs: each shows an iOS action
    sheet. The event's "This date only / This and upcoming dates" shows both actions stacked.
  - At 1280, each is the centred dialog as before.
- [ ] **Step 3: Commit** with the message `feat(cms): confirmations as iOS action sheets on phones`.

### Task 8: Grouped form cells

**Files:**

- Create: `apps/cms/src/components/form-cells.tsx`.

**Interfaces:**

- **Produces:**
  ```tsx
  export function FormSection(props: {
    title?: string;
    footer?: string;
    children: ReactNode;
  }): JSX.Element;
  /** Label left and control right on phones; label above the control on wider screens, as today. */
  export function FormCell(props: {
    label: string;
    htmlFor?: string;
    hint?: string;
    children: ReactNode;
  }): JSX.Element;
  /** Label (and optional description) left, Switch right, on every size. Calls useMarkSheetDirty. */
  export function FormSwitchCell(props: {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }): JSX.Element;
  /** Full-width content (rich text, image galleries, maps) in its own group on phones. */
  export function FormBlock(props: {
    label: string;
    labelId?: string;
    hint?: string;
    children: ReactNode;
  }): JSX.Element;
  ```
- **Phones:**
  - `FormSection` is a rounded group on `--ios-cell-raised` (inside a sheet) or `--ios-cell`
    (on a page). Its title becomes a 13px uppercase heading, and its footer a 13px
    `--ios-secondary` line below the group.
  - `FormCell` is a 44px row with the label left (17px) and the control right.
  - Inputs and textareas inside a `FormCell` lose their border and fill, align right, and use
    17px text.
  - A `Select` trigger inside a `FormCell` shows its value right-aligned with a chevron.
  - Hints show in `--ios-secondary` under the row, inside the group.
  - Switches use the `--brand` tint when on, like iOS's tint colour.
- **Wider screens:** the same markup as today's
  `<div className="space-y-1.5"><Label/>{control}<p className="text-muted-foreground text-xs">{hint}</p></div>`.
  Sections are only spacing.
- **Dirty tracking:** the cells call `useMarkSheetDirty()` where native events do not fire.

- [ ] **Step 1:** Build the four components with the phone and wider-screen layouts above.
- [ ] **Step 2:** Move the **location form** onto them, as the reference migration.
- [ ] **Step 3: Check.**
  - At 390, the location sheet matches the chosen mock-up (option A): grouped sections, the label
    left and value right, State and Stage as rows with a chevron, and Published as a switch row.
  - At 1280, the location form in the pane looks as before.
- [ ] **Step 4: Commit** with the message `feat(cms): grouped form cells, starting with locations`.

### Task 9: Move every list page onto the shared parts

**Files** (each list page's `*-page.tsx` and its form): events (and guests), team, testimonials,
FAQs, announcements, media coverage, redirects, terms (categories and tags), posts list, users and
API keys.

**Interfaces:**

- **Consumes:** `PageActions` (Task 2), `ListRows inset` (Task 3), `SegmentedControl` (Task 4),
  `useSheetFormId` (Task 6) and the form cells (Task 8).
- **Per page:**
  1. Put the add button in `PageActions add`. Put extra actions (Bulk update, CSV export) in
     `PageActions more`.
  2. Put Edit mode in `PageActions edit`, and hide the page's own buttons below `md`.
  3. Pass `inset="media"` where rows have a thumbnail.
  4. Move the form onto `FormSection`, `FormCell`, `FormSwitchCell` and `FormBlock`.
  5. Rich text, image fields and date pickers go in `FormBlock` or `FormCell` as fits.
  6. The event form keeps its three steps. On phones, its step bar sits under the sheet header.
- **Rule:** follow the spec's calls 3 and 4. Rows keep their thumbnails, badges and extra lines.

- [ ] **Step 1:** Migrate events and team, then check them.
- [ ] **Step 2:** Migrate testimonials, FAQs, announcements and media coverage, then check them.
- [ ] **Step 3:** Migrate redirects, terms, the posts list, users and API keys, then check them.
- [ ] **Step 4: Check each migrated page.**
  - At 390, the page has the same header pattern as Locations, with no big buttons, a grouped list
    and an iOS sheet form.
  - At 1280, it is unchanged.
  - Commit after each step's group of pages, with the message
    `feat(cms): <pages> in the iOS style on phones`.

### Task 10: Media library and the post editor's top bar

**Files:**

- Modify: `apps/cms/src/components/media/media-page.tsx`.
- Modify: `apps/cms/src/components/posts/post-editor/editor-toolbar.tsx`.

**Interfaces:**

- **Media** (spec call 4):
  - it stays a thumbnail grid: 3 columns on phones, 2px gaps, square tiles, no rounding;
  - upload goes in `PageActions add`, and Edit (select) in `PageActions edit`;
  - the media panel is a sheet that uses the form cells.
- **Post editor** (spec call 8):
  - on phones, the top bar shows **‹ Posts** (the existing back link), the post title (truncated
    and read-only), and **Publish**, or **Update** when the post is published;
  - every other toolbar action goes in a **…** menu beside Publish: save draft, schedule,
    preview, discard, import Word and properties;
  - an author's toolbar (Request review) follows the same pattern, with its main action on the
    right;
  - desktop is unchanged.

- [ ] **Step 1:** Media.
- [ ] **Step 2:** Post editor top bar, checked for the full, author, SEO and read-only access
      levels (`post-access.ts`).
- [ ] **Step 3: Check.**
  - At 390, the media grid and media sheet look right.
  - The post editor shows ‹ Posts / title / Publish, and the … menu holds every other action.
  - Review focus 3: a long post title truncates.
  - At 1280, both are unchanged.
- [ ] **Step 4: Commit** with the message `feat(cms): media grid and post editor bar in the iOS style`.

### Task 11: More, Dashboard, Settings, Profile and the other pages

**Files:**

- Modify: `apps/cms/src/components/shell/tab-bar.tsx` (`MoreSheet`).
- Modify: `apps/cms/src/components/dashboard/*`.
- Modify: `apps/cms/src/components/settings/settings-page.tsx`.
- Modify: `apps/cms/src/components/profile/profile-page.tsx`.
- Modify: `apps/cms/src/components/activity/activity-page.tsx`.
- Modify: `apps/cms/src/components/checks/content-checks-page.tsx`.
- Modify: `apps/cms/src/components/missing-pages/missing-pages-page.tsx`.

**Interfaces:**

- **More** (spec call 5):
  - it opens with a profile cell: 60px avatar, name in 20px, email in 15px `--ios-secondary`,
    and a chevron, linking to `/profile`;
  - then the existing sections;
  - then a red **Sign out** row in its own group, calling `authClient.signOut()` as `NavUser` does;
  - `NavUser`'s phone account drawer is no longer reachable once Task 2 hides it on phones. Its
    sign-out now lives here, and the desktop dropdown is unchanged.
- **Dashboard** (spec call 9): stat cards stay cards, styled as rounded `--ios-cell` groups, and
  its lists become grouped lists.
- **Settings and Profile:** `FormSection` and the form cells, laid out like the iPhone Settings app.
- **Activity, Content checks and Missing pages:**
  - grouped lists;
  - Activity's filters sit in one row under the large title, and its pager goes below the group;
  - their items keep their current content.

- [ ] **Step 1:** More sheet.
- [ ] **Step 2:** Dashboard.
- [ ] **Step 3:** Settings and Profile.
- [ ] **Step 4:** Activity, Content checks and Missing pages.
- [ ] **Step 5: Check.**
  - At 390, each page is grouped and iOS-like, and Sign out in More signs you out.
  - At 1280, each page is unchanged, and the account menu still holds sign out.
- [ ] **Step 6: Commit** with the message `feat(cms): More, dashboard and settings in the iOS style`.

### Task 12: Full sweep and sign-off screenshots

**Files:** none new. This task fixes whatever the sweep finds.

- [ ] **Step 1:** Screenshot every page in the spec's "Pages in scope" at 390×844 mobile and
      touch, in light and dark, scrolled to the top and with the large title collapsed. Include one
      open sheet and one action sheet per list page.
- [ ] **Step 2:** Review focus 4. Screenshot every page at 800×1000 and at 1280×800, and compare
      them with screenshots taken from `master` before the branch. Any difference is a bug.
- [ ] **Step 3:** Review focus 5. In light mode, check that separators are visible and that tint
      text on `--ios-cell` reads clearly. Use the contrast check in Chrome DevTools, aiming for
      at least 4.5:1 for text.
- [ ] **Step 4:** Run `bun run type-check && bun run lint && bunx prettier --check apps packages && bun run test && bun run build`.
- [ ] **Step 5:** Hand the 390px screenshots to the owner for sign-off, and ask them to try sheets
      and the keyboard on a real iPhone (spec call 10).
- [ ] **Step 6: Commit** any fixes with the message `fix(cms): phone UI sweep`.

# CMS on phones: native iOS look

Date: 8 November 2026. Status: approved in conversation; build plan to follow.

## Why

Staff use the CMS on their iPhones. Today each phone screen is a desktop layout squeezed down,
and pages disagree with each other. Locations looks different from Team, which looks different
from Events: the add button sits beside the title on one and under the search on another, and a
bordered list box stretches to the bottom of the screen on some pages and stops after its rows
on others. The goal is for the CMS on a phone to feel like an app built with SwiftUI or UIKit,
the same on every page.

Success: someone who uses Settings, Mail or Reminders every day finds the CMS behaves the way
they expect. Every phone page follows one set of rules, so no page looks out of place.

## Goals

- Every phone screen follows the UIKit patterns below.
- The patterns live in shared components (list building blocks, shell, form fields, dialogs), so
  pages get them by using those components rather than each page restyling itself.
- Locations, Team and Events end up looking alike, because they use the same parts.

## Non-goals

- Desktop and tablet do not change. "Phone" means below the `md` breakpoint (768px), where the
  bottom tab bar shows today. The 768 to 1023px range (sidebar plus dialogs) stays as it is.
- No new features, permissions or data. Same pages, same content, same actions.
- Not a native app. It stays the web CMS.
- The rich-text editor's internals (`components/editor`, `components/extensions`,
  `components/templates`) are not restyled beyond what sits around them.

## Anti-goals (failure even if it technically works)

- A page that still looks like the old layout because it was skipped. Every list page, form,
  confirmation and settings page under the tab bar must be covered.
- Copying Apple's branding, SF Symbols artwork or system fonts that are not licensed for the web.
  We copy the patterns: layout, spacing, gestures and behaviour.
- Breaking desktop while changing phones.
- Tap targets under 44pt, or anything reachable only by hover.

## Decided in conversation

### Top bar and title (all phone pages)

- **Top bar:** left is **Edit** (where the page has Edit mode). On a page below a tab, the left
  is the existing back link instead. Right is the **bell** (notifications), then **+** to add.
- **Large title** under the top bar. When you scroll, it collapses into a small centred title in
  the top bar. The top bar already does this (`useLargeTitle` in `components/shell`); keep it and
  make every page use it.
- **Search** is an iOS-style field under the large title: rounded, filled, no border, placeholder
  "Search".
- **Account:** your initials move off the top bar. The account menu lives under **More**.
- **Big buttons go:** "Add location", "New event", "Add member" and similar big buttons become the
  **+** in the top bar.
- **Extra actions** (for example Team's "Bulk update") go in the **+** menu, or in a **…** menu in
  the top bar, so every page has the same header.

### Lists (all list pages)

- An inset grouped list, like UIKit's `.insetGrouped`:
  - a small count label above the group (for example "7 locations");
  - one rounded group, slightly lighter than the page background;
  - hairline dividers that start after the thumbnail, or after the left padding when there is no
    thumbnail;
  - a chevron on each row;
  - rows at least 44pt tall.
- **The group ends with its last row.** No empty bordered box down to the bottom of the screen.
- Swipe-to-delete on rows stays.
- Edit mode (ticking rows, bulk delete) stays, with **Edit** in the top bar.

### Filters

- Filter buttons become one iOS **segmented control**. Example: Events' Upcoming, Drafts, Past,
  All.

### Messages (toasts)

- Messages such as "Event saved" appear as a banner sliding down from the top, like an iOS
  notification, instead of from the bottom above the tab bar.
- Desktop keeps its current position.

### Editing: sheet (option A, chosen)

- Tapping a row or **+** opens the form as a sheet that slides up over the list. Swipe down to
  close.
- The sheet's top bar has **Cancel** on the left, the title in the middle, and **Save** (or
  **Add**) on the right, bold, in the accent colour. No buttons at the bottom of the sheet.
- Dialogs already become swipeable bottom drawers on phones (`components/ui/dialog.tsx` via
  `components/ui/drawer.tsx`). This work changes how they look, not how they work.
- **Fields in grouped sections:**
  - the label on the left and the value on the right;
  - a switch for on/off;
  - a › where tapping opens a list of choices;
  - a small grey section heading above each group, and an optional footnote below it.

### Colour and theme

- The accent colour (buttons, links, the active tab, switches) is the brand green, used the way
  iOS uses its tint colour.
- Dark and light mode both follow the phone's setting, as today. The mock-ups were in dark mode;
  light mode follows the same rules with the iOS light colours.

## Proposed and not objected to (treat as decided)

- **Long forms:**
  - The event form keeps its three steps inside the sheet, with a small step bar under the
    sheet's top bar.
  - Rich-text description fields become full-width boxes in their own group.
- **Post editor:** it already fills the screen on phones. It gets the same top bar: **‹ Posts** on
  the left, the title in the middle, **Publish** on the right.
- **Confirmations** ("Delete this location?") become an iOS bottom action sheet: the question, a
  red **Delete**, and **Cancel** below it. They already open as bottom drawers on phones.
- **Dashboard, Settings, Profile and More** use the same grouped lists. Settings looks like the
  iPhone Settings app.

## Constraints

- **Stack:** CMS at `apps/cms`, built with TanStack Start, shadcn on Base UI, and Tailwind 4.
  - Phone variants use `max-md:` (and the existing `touch:` variant for touch-only behaviour).
  - Shared phone patterns go in `components/list`, `components/shell` and the form-field
    components, not page by page.
  - `components/ui` primitives are edited sparingly (repo rule); prefer wrapping them.
- **Repo rules** (`AGENTS.md`):
  - tappable rows at least 44pt;
  - check every change at 390px with touch emulation, and on desktop;
  - user-facing copy is plain, sentence case and in Australian English;
  - form errors show as toasts on submit, never inline (standing preference).
- **Fonts:** the CMS font stays (Inter). Sizes and weights follow iOS's type scale:
  - large title about 34pt bold;
  - body about 17pt;
  - secondary text about 15pt;
  - section headings about 13pt, uppercase.
- **Toasts:** Sonner (`components/ui/sonner.tsx`, set up in `routes/__root.tsx`).

## Calls made after review (designer's calls; check these)

A reviewer read this document as a builder would. These settle what it asked.

1. **Phone only, one component.** The sheet's top-bar buttons, grouped fields and action-sheet
   confirmations apply on phones only. Desktop and tablet dialogs keep their buttons at the bottom.
   Build one shared form-sheet component that places the same Cancel and Save actions in the top
   bar on phones and in the footer elsewhere. Do not give each form two layouts.
2. **Save in the top bar** submits the form, through the form's `id`, and shows the same pending
   and disabled state as today.
   - The multi-step event form shows **Next** until its last step, then **Save** (or **Create**),
     as its footer does today.
   - Closing a sheet that has unsaved edits, by Cancel or by swiping down, asks **Discard
     changes?** in an action sheet. An unchanged sheet closes straight away. This is the iOS
     standard.
3. **Each page tells the shell what to show in the top bar** (a slot or context). The shell does
   not guess. Which pages get what follows today:
   - **+** wherever the page has an add button now;
   - **Edit** wherever it has Edit mode now;
   - **…** for any other actions, such as Bulk update.

   Pages with neither (Dashboard, Activity, Content checks, Missing pages, Settings, Profile, More)
   show only the bell, plus the back link where there is one.
4. **Row content stays as it is today.** Rows keep their thumbnails, badges and extra lines inside
   the grouped cell. They are not cut down to two lines.
   - The media library stays a thumbnail grid, like the Photos app.
   - It gets the top bar, large title, search and segmented filter, but no grouped list.
5. **More** starts with a profile cell (photo, name, email), like the iPhone Settings app. It opens
   Profile.
   - Below it, the existing More items.
   - At the bottom, a red **Sign out** row.
   - Desktop keeps its account menu unchanged.
6. **Messages on phones:**
   - They sit under the status bar and notch, over the top bar.
   - They stack, and they can be swiped up to dismiss.
   - They disappear on their own as today; errors stay up longer, as they do now.
   - Implement this with a breakpoint-aware position on the one Sonner setup. Desktop is unchanged.
7. **The green accent is for phones only.** Scope the tint tokens to phones (`max-md` or a
   phone-only attribute) so desktop's `--primary` does not change. Destructive actions stay red.
8. **Post editor top bar:**
   - **‹ Posts** on the left;
   - the post's title in the middle, truncated and not editable there;
   - **Publish** on the right (**Update** for a published post).

   Every other current action (save draft, schedule, preview, discard, import) goes in a **…**
   menu beside Publish.
9. **Dashboard:**
   - Stat cards stay as cards, restyled as rounded iOS groups.
   - Lists on it (recent posts and so on) become grouped lists.
   - Activity keeps its paging and filters: the filters become one row under the search, and the
     pager sits below the group.
10. **Visual reference.** The mock-ups chosen in the conversation are in
    `.superpowers/brainstorm/` (local only, not committed). Sign-off is by screenshots of each page
    at 390px with touch emulation, shown to the owner for approval. The owner also checks the
    sheets and keyboard behaviour on a real iPhone before release.

Lower-priority points, also settled:
- A segmented control is used only where a filter has 2 to 4 options. Longer filters, such as
  categories and tags, stay a picker (a › row that opens a list).
- Bulk delete and discard confirmations use the action sheet as well.

## Left to the builder

- **Exact colours:** colour values for grouped backgrounds, cells, separators and secondary text in
  dark and light mode. Match iOS system colours closely, as CSS tokens.
- **Shared parts:** how the grouped-list and form-cell parts are split into components, and how
  existing forms move onto them.
- **The … menu:** whether a page's extra actions use **+** with a menu or a separate **…**.
  Choose per page, consistently.
- **Motion:** sheet springs and timings. Respect reduced motion.
- **Build order:** pages in whatever order makes progress reviewable, ideally shared parts first,
  then one list page, then the rest.

## Pages in scope (phone)

- Dashboard.
- Posts (list), categories and tags, and the post editor's top bar.
- Media library and the media panel.
- Locations, Events (with guests), Team, Testimonials, FAQs, Announcements, Media coverage.
- Redirects, Missing pages, Content checks, Activity.
- Users, API keys, Settings, Profile, and the More tab.
- All dialogs (as sheets) and confirmations (as action sheets).
- Toasts.

# Editable legal pages

**Date:** 2026-11-10
**Status:** approved design, awaiting spec review
**Builds on:** `feat/web-seo-metadata` (needs its on-request sitemap)

## Goal

Editors change the privacy policy and the terms and conditions in the CMS, and
the website shows the published version on the next request, with no deploy.
Every published version is kept, so we can show what a page said on any date.

Only these two pages. Other static pages (about, our partners) stay in code
until there is a reason to move them; the table is shaped so they could join
later without a migration of its structure.

## Decisions

| Question | Decision |
| --- | --- |
| How changes go live | Draft, preview, publish. Published versions are kept with date and publisher. |
| Who can change them | `content:write` edits drafts and asks for review. New `legal:publish` (admin only) publishes and discards. |
| Storage | New `legal_pages` table on the shared lifecycle columns, plus the existing `revisions` and `publish_events` tables. Not posts, not site settings. |
| Which pages | Two fixed rows: `privacy` and `terms-and-conditions`. No add or delete in the CMS. |
| URLs and look | Unchanged: `/privacy/` and `/terms-and-conditions/`, same layout and contents list. |

## Data

New table in `packages/db/src/schema/content.ts`:

```ts
export const legalPages = sqliteTable('legal_pages', {
  id: id(),
  slug: text('slug').notNull().unique(),          // 'privacy' | 'terms-and-conditions'
  title: text('title').notNull(),
  body: richText('body'),
  seoDescription: text('seo_description'),
  /** Set on every publish; drives "Last updated". (`publishedAt` is the first publish.) */
  lastPublishedAt: integer('last_published_at', { mode: 'timestamp_ms' }),
  reviewRequestedAt: integer('review_requested_at', { mode: 'timestamp_ms' }),
  reviewerId: text('reviewer_id').references(() => user.id, { onDelete: 'set null' }),
  ...lifecycle(),
});
```

- `status`, `draft`, `publishedAt`, `createdBy`, `updatedBy`, `createdAt` and
  `updatedAt` come from `lifecycle()`. `deletedAt` is unused (pages cannot be
  trashed).
- The typed columns hold the **live** version. Pending edits live in `draft`
  (`{ title, body, seoDescription }`), exactly as posts do. Saving writes
  `draft`; publishing copies it onto the columns and clears it.
- `packages/db/src/enums.ts`: add `'legal_page'` to `entityTypes` and
  `'legal_page.published'`, `'legal_page.review_requested'` to
  `activityActions`.
- `packages/content/src/roles.ts`: add `'legal:publish'` to `permissions`;
  admins get it through `permissions`, nobody else.

### Migration and seed

`bun run --filter @ll/db generate -- --name legal-pages` creates the table. A
second, hand-written migration inserts the two rows, `status = 'published'`,
with today's text as rich-text JSON and `published_at` / `last_published_at`
set to the date the current text was last changed on the live site (privacy
and terms carry no date today, so the migration date is used).

The JSON is produced once by a script (`packages/db/scripts/seed-legal-pages.ts`,
not shipped): it takes the text from the two `.astro` files, rewritten as
Markdown by hand, and runs it through `markdownToRichText` from
`@ll/content`. The script and the Markdown sources are committed so the seed
can be regenerated and reviewed; the migration holds the output.

The privacy page's related-locations block is **not** part of the body; it
stays in the template.

## Server (`apps/cms/src/server/legal-pages.ts`)

| Function | Middleware | Does |
| --- | --- | --- |
| `listLegalPages` | `authMiddleware` | Both rows with status, `hasDraft`, `reviewRequestedAt`, `lastPublishedAt`. |
| `getLegalPageEditorData` | `authMiddleware` | One page: live fields, draft, `updatedAt`, and its published versions (from `revisions`, newest first, with publisher name). |
| `saveLegalPage` | `requirePermission('content:write')` | Writes `draft` and `updatedBy`. Takes `expectedUpdatedAt`; a mismatch throws the same conflict error as posts. |
| `requestLegalReview` | `requirePermission('content:write')` | Sets `reviewRequestedAt` and `reviewerId`; logs `legal_page.review_requested`. |
| `publishLegalPage` | `requirePermission('legal:publish')` | Copies draft onto the columns, clears `draft` and the review fields, sets `lastPublishedAt` (and `publishedAt` if empty). In one batch: the update, a `revisions` row (snapshot of `{ title, body, seoDescription }`), a `publish_events` row (`action: 'publish'`, `paths: ['/<slug>/']`) and the activity entry. Checks `expectedUpdatedAt`. |
| `discardLegalDraft` | `requirePermission('legal:publish')` | Clears `draft` and the review fields. |
| `getLegalRevision` | `authMiddleware` | One revision's snapshot, for the read-only history view. |

Publishing with no draft is refused ("There are no changes to publish.").
Every error is a sentence the CMS shows as a toast.

`server/notifications.ts`: admins (`legal:publish`) also see legal pages with
`reviewRequestedAt` set, linking to the editor.

## CMS screens

- `lib/nav.ts`: **Legal pages** in the About group, after FAQs, shown to roles
  with `content:write`.
- `routes/_app/legal/index.tsx` → `components/legal/legal-pages-list.tsx`: the
  two pages as rows (title, status badge, "Last updated"). Two rows do not
  need the shared list-page machinery (selection, swipe delete), so this is a
  plain list linking to the editor.
- `routes/_app/legal/$slug.tsx` → `components/legal/legal-page-editor.tsx`:
  - Main column: `DocumentEditor` (title and body) with the post editor's
    toolbar.
  - Side panel: status, "Last updated", SEO description field, and
    **History**: published versions, each opening a read-only view of that
    snapshot in a dialog.
  - Actions: **Save** and **Preview** for `content:write`; **Ask for review**
    for those without `legal:publish`; **Publish** and **Discard changes** for
    `legal:publish`. Actions go through `useAction()`.
- `routes/preview/legal/$slug.tsx`: renders the draft (or live version) with
  the post preview's renderer.

## Website (`apps/web`)

- `src/lib/legal-pages.ts`: `getLegalPage(slug)` reads the live columns from
  D1 (title, body, `seo_description`, `last_published_at`) where
  `status = 'published'`.
- `src/pages/privacy.astro`, `src/pages/terms-and-conditions.astro`:
  `export const prerender = false`; render the body with `renderRichText` inside
  the existing `Prose` layout, build the contents list from the body's h2s
  (`outlineRichText`), and show "Last updated <date>" under the title, formatted
  `d MMMM yyyy` in Australia/Sydney.
- If the row is missing or the query fails: a short "This page is temporarily
  unavailable" message with status 503 and `Retry-After: 300`, never a 404.
- Privacy keeps its related-locations block; its text changes from
  "Mornington Green" to "Living Legacy Mornington".
- `src/pages/sitemap-pages.xml.ts`: add `/privacy/` and
  `/terms-and-conditions/`, with `lastmod` from `last_published_at`.

## Tests

Integration (`apps/cms/src/server/legal-pages.integration.test.ts`):

- an editor can save a draft but `publishLegalPage` is refused;
- an admin publish copies the draft live, clears it, sets `lastPublishedAt`,
  and writes one revision, one publish event and one activity entry;
- a stale `expectedUpdatedAt` is refused on save and publish;
- publishing with no draft is refused;
- a review request shows in an admin's notifications.

Unit: the seed script's Markdown converts to headings, lists and links as
expected (`packages/content`), and `roles.test.ts` covers `legal:publish`.

Manual: both pages on a dev server match today's text and layout, show
"Last updated", and the CMS edit, preview, review and publish loop works at
desktop width and at 390px.

## Out of scope

- Other static pages, menus, scheduling a publish, comparing two versions side
  by side, restoring an old version in one click (copy from the history view
  instead).

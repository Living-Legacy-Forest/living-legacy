# Editable legal pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors change the privacy policy and the terms and conditions in the CMS (draft, review, admin publish, kept history), and the website renders the published version on each request.

**Architecture:** A `legal_pages` table on the shared lifecycle columns holds the live version and a pending `draft`, with every publish snapshotted into the existing `revisions` table. Database work lives in `server/legal-page-store.ts` (testable against local D1); thin server functions add the permission middleware. The website reads the live columns with raw D1 SQL, like the blog.

**Tech Stack:** Drizzle on D1, TanStack Start server functions, React 19 with shadcn on Base UI, Tiptap JSON rich text, Astro 5 on Cloudflare Workers, vitest (unit and Miniflare integration), Bun.

**Spec:** `docs/superpowers/specs/2026-11-10-legal-pages-design.md`

**Branch:** `feat/legal-pages` (already created from `feat/web-seo-metadata`, which this needs for `apps/web/src/pages/sitemap-pages.xml.ts`).

## Global Constraints

- Slugs are exactly `privacy` and `terms-and-conditions`; URLs stay `/privacy/` and `/terms-and-conditions/`.
- `content:write` edits drafts and asks for review; `legal:publish` (admins only) publishes and discards.
- The website reads only the live columns (`title`, `body`, `seo_description`, `last_published_at`) where `status = 'published'`, never `draft`.
- "Last updated" is formatted `d MMMM yyyy` in `Australia/Sydney` (`5 August 2026`).
- A missing row or failed query renders a 503 with `Retry-After: 300`, never a 404.
- Forests are always "Living Legacy" + place name: the privacy page's related-locations block says **Living Legacy Wellington Dam** and **Living Legacy Mornington**.
- User-facing copy: plain, sentence case, Australian English, no em or en dashes, no exclamation marks. Errors are sentences the CMS shows as toasts.
- Icons from `@/components/icons` only; loading states use `Spinner`; mutations go through `useAction()`.
- Import tables from `@ll/db/schema` and enums from `@ll/db/enums`; never import `@ll/db` values into a component.
- Commits: Conventional Commits, header at most 100 characters, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Format what you touch: `bunx prettier --write <paths>`.

**Spec change made by this plan:** the spec lists a `reviewerId` column. There is no reviewer picker (only admins can publish, so a request goes to all of them), so the column is dropped. Task 1 updates the spec line.

## Review Focus

1. **Publish with unsaved edits on screen.** Expect: Publish saves what is on screen first, then publishes that. Pinned in Task 5 (editor `publish()` calls `save()` when dirty) and checked in Task 5 Step 6.
2. **An empty page.** A cleared title or body must not go live. Pinned by `legalPublishErrors` tests in Task 1 and the store test "refuses to publish an empty page" in Task 3.
3. **A saved but unpublished change leaking to the website.** Expect the site to show only the published text. Checked in Task 6 Step 6 (save a draft, reload the site, text unchanged).
4. **"Last updated" across midnight.** A publish at 11pm UTC is the next day in Sydney. Pinned by the `formatLegalDate` check in Task 6 Step 2.
5. **Old `#fragment` links.** Heading ids come from `renderRichText` now, not hand-written ids. Task 6 Step 6 compares the generated ids with the old ones and lists any that changed in the PR description.

---

## File map

| File                                                                                            | Responsibility                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/content/src/legal-pages.ts` (new)                                                     | Slugs, value schema, publish checks, path. Shared by CMS and website.    |
| `packages/content/src/roles.ts`                                                                 | `legal:publish` permission.                                              |
| `packages/db/src/schema/content.ts`, `packages/db/src/enums.ts`                                 | `legal_pages` table, `legal_page` entity, two activity actions.          |
| `packages/db/migrations/00NN_legal-pages.sql`, `00NN_legal-pages-seed.sql` (generated)          | Table, then the two seeded rows and their first revisions.               |
| `apps/cms/scripts/legal-pages/*.md`, `apps/cms/scripts/seed-legal-pages.ts` (new)               | Today's text as Markdown, and the script that writes the seed migration. |
| `apps/cms/src/server/legal-page-store.ts` (new)                                                 | All database work for legal pages.                                       |
| `apps/cms/src/server/legal-pages.ts` (new)                                                      | Server functions with permission middleware.                             |
| `apps/cms/src/server/notifications.ts`, `components/shell/notifications.tsx`                    | Review requests in the bell.                                             |
| `apps/cms/src/lib/nav.ts`                                                                       | Sidebar item.                                                            |
| `apps/cms/src/routes/_app/legal/index.tsx`, `$slug.tsx`, `routes/preview/legal/$slug.tsx` (new) | Routes.                                                                  |
| `apps/cms/src/components/legal/*.tsx` (new)                                                     | List, editor, history dialog.                                            |
| `apps/web/src/lib/legal-pages.ts` (new)                                                         | Read the live page from D1, render it, format the date.                  |
| `apps/web/src/pages/privacy.astro`, `terms-and-conditions.astro`, `sitemap-pages.xml.ts`        | Render from the database; sitemap entries.                               |

---

### Task 1: Shared rules, permission, table and migration

**Files:**

- Create: `packages/content/src/legal-pages.ts`, `packages/content/src/legal-pages.test.ts`
- Modify: `packages/content/src/index.ts`, `packages/content/src/roles.ts`, `packages/content/src/roles.test.ts`, `packages/db/src/enums.ts`, `packages/db/src/schema/content.ts`, `docs/superpowers/specs/2026-11-10-legal-pages-design.md`
- Generated: `packages/db/migrations/00NN_legal-pages.sql` and its snapshot

**Interfaces:**

- Produces (`@ll/content`): `legalSlugs`, `type LegalSlug`, `legalSlugSchema`, `legalValuesSchema`, `type LegalValues = { title: string; body: RichTextDoc | null; seoDescription: string }`, `legalPublishErrors(values: LegalValues): string[]`, `legalPath(slug: LegalSlug): string`, permission `'legal:publish'`.
- Produces (`@ll/db/schema`): `legalPages` table. (`@ll/db/enums`): entity `'legal_page'`, actions `'legal_page.published'`, `'legal_page.review_requested'`.

- [ ] **Step 1: Write the failing tests**

`packages/content/src/legal-pages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { legalPath, legalPublishErrors } from './legal-pages';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});

describe('legalPublishErrors', () => {
  it('accepts a page with a title and text', () => {
    expect(
      legalPublishErrors({
        title: 'Privacy policy',
        body: doc('We keep it safe.'),
        seoDescription: '',
      })
    ).toEqual([]);
  });

  it('refuses a missing title', () => {
    expect(legalPublishErrors({ title: '  ', body: doc('Text'), seoDescription: '' })).toEqual([
      'Add a title before publishing.',
    ]);
  });

  it('refuses a body with no text', () => {
    expect(legalPublishErrors({ title: 'Terms', body: doc(''), seoDescription: '' })).toEqual([
      'Add the page text before publishing.',
    ]);
    expect(legalPublishErrors({ title: 'Terms', body: null, seoDescription: '' })).toEqual([
      'Add the page text before publishing.',
    ]);
  });
});

describe('legalPath', () => {
  it('is the page URL with a trailing slash', () => {
    expect(legalPath('terms-and-conditions')).toBe('/terms-and-conditions/');
  });
});
```

In `packages/content/src/roles.test.ts`, add:

```ts
it('lets only admins publish legal pages', () => {
  expect(can('admin', 'legal:publish')).toBe(true);
  for (const role of ['editor', 'author', 'seo', 'viewer'] as const) {
    expect(can(role, 'legal:publish')).toBe(false);
  }
  expect(can('editor', 'content:write')).toBe(true);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `bun run --filter @ll/content test`
Expected: FAIL, `Cannot find module './legal-pages'` and `legal:publish` not a permission.

- [ ] **Step 3: Implement**

`packages/content/src/legal-pages.ts`:

```ts
// The legal pages editors change in the CMS. Fixed: there is no adding or
// deleting them, so the slugs are the whole list.
import { z } from 'zod';
import { type RichTextDoc, richTextSchema } from './posts';
import { richTextPlainText } from './rich-text-html';

export const legalSlugs = ['privacy', 'terms-and-conditions'] as const;
export type LegalSlug = (typeof legalSlugs)[number];
export const legalSlugSchema = z.enum(legalSlugs);

export const legalValuesSchema = z.object({
  title: z.string().trim().max(200),
  body: richTextSchema.nullable(),
  seoDescription: z.string().trim().max(300),
});
export type LegalValues = { title: string; body: RichTextDoc | null; seoDescription: string };

/** Why a version cannot go live yet; empty when it can. */
export function legalPublishErrors(values: LegalValues): string[] {
  const errors: string[] = [];
  if (!values.title.trim()) errors.push('Add a title before publishing.');
  if (!values.body || !richTextPlainText(values.body).trim()) {
    errors.push('Add the page text before publishing.');
  }
  return errors;
}

export const legalPath = (slug: LegalSlug) => `/${slug}/`;
```

`packages/content/src/index.ts`: add `export * from './legal-pages';`.

`packages/content/src/roles.ts`: add `'legal:publish'` to the end of `permissions`. Admins already get every permission; do not add it to any other role.

`packages/db/src/enums.ts`: add `'legal_page'` to the end of `entityTypes`, and `'legal_page.published'`, `'legal_page.review_requested'` to the end of `activityActions`.

`packages/db/src/schema/content.ts`, after `posts` (it already imports `sqliteTable`, `text`, `integer`, `id`, `lifecycle`, `richText`):

```ts
/** The privacy policy and the terms: live columns, pending edits in `draft`. */
export const legalPages = sqliteTable('legal_pages', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: richText('body'),
  seoDescription: text('seo_description'),
  /** Set on every publish; drives "Last updated". `publishedAt` is the first publish. */
  lastPublishedAt: integer('last_published_at', { mode: 'timestamp_ms' }),
  reviewRequestedAt: integer('review_requested_at', { mode: 'timestamp_ms' }),
  ...lifecycle(),
});
```

In the spec, delete the `reviewerId` line from the table and change "Sets `reviewRequestedAt` and `reviewerId`" to "Sets `reviewRequestedAt`".

- [ ] **Step 4: Generate the migration and run the tests**

```sh
bun run --filter @ll/db generate -- --name legal-pages
bun run --filter @ll/cms db:migrate:local
bun run --filter @ll/content test
bun run type-check
```

Expected: a new `packages/db/migrations/00NN_legal-pages.sql` containing `CREATE TABLE \`legal_pages\``and a unique index on`slug`; tests PASS; type-check exits 0.

- [ ] **Step 5: Commit**

```bash
bunx prettier --write packages/content/src packages/db/src docs/superpowers/specs/2026-11-10-legal-pages-design.md
git add packages docs/superpowers/specs/2026-11-10-legal-pages-design.md
git commit -m "feat(db): legal pages table, legal:publish permission and shared rules"
```

---

### Task 2: Move today's text in

**Files:**

- Create: `apps/cms/scripts/legal-pages/privacy.md`, `apps/cms/scripts/legal-pages/terms-and-conditions.md`, `apps/cms/scripts/seed-legal-pages.ts`, `apps/cms/src/server/legal-seed.test.ts`
- Generated: `packages/db/migrations/00NN_legal-pages-seed.sql`

**Interfaces:**

- Consumes: `markdownToRichText` and `isAllowedRichText` from `@ll/content`; the `legal_pages` and `revisions` tables from Task 1.
- Produces: two `legal_pages` rows (ids `legal_privacy`, `legal_terms`), each `status = 'published'` with one revision. Every database built from migrations, including each integration test file's, has them.

- [ ] **Step 1: Write the Markdown sources**

Copy the body text of `apps/web/src/pages/privacy.astro` (everything inside `<Prose>…</Prose>`, lines 94 to 334) into `privacy.md`, word for word. Each `<h2>` becomes `## `, `<h3>` becomes `### `, `<ul><li>` becomes `- `, `<a href="x">t</a>` becomes `[t](x)`, `<strong>` becomes `**`. Do not include the header, the contents list or the related-locations block.

Do the same for `terms-and-conditions.astro` (inside `<Prose>`, lines 89 to 257) into `terms-and-conditions.md`, keeping `<ol>` items as `1. ` lists. The header's lead paragraph and the waiver download button stay in the template (Task 6), not in the Markdown. The source comments say wording is copied exactly, including the PDF's slips; keep them.

- [ ] **Step 2: Write the failing test**

`apps/cms/src/server/legal-seed.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAllowedRichText, markdownToRichText, outlineRichText } from '@ll/content';
import { describe, expect, it } from 'vitest';

const source = (slug: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../scripts/legal-pages/${slug}.md`, import.meta.url)),
    'utf8'
  );

describe('legal page seed text', () => {
  it.each([
    ['privacy', 9],
    ['terms-and-conditions', 4],
  ])('%s converts to valid rich text with its %i sections', (slug, sections) => {
    const doc = markdownToRichText(source(slug));
    expect(isAllowedRichText(doc)).toBe(true);
    const h2s = outlineRichText(doc).headings.filter((h) => h.level === 2);
    expect(h2s).toHaveLength(sections);
  });
});
```

Before relying on `outlineRichText(doc).headings` and `h.level`, open `packages/content/src/rich-text-outline.ts` and use the field names it actually returns for headings; adjust the two lines above to match.

- [ ] **Step 3: Run it**

Run: `bun run --filter @ll/cms test:unit -- legal-seed`
Expected: PASS once the Markdown is complete. If a section count is off, a heading was missed in Step 1; fix the Markdown, not the number.

- [ ] **Step 4: Write the seed script**

`apps/cms/scripts/seed-legal-pages.ts`:

```ts
// Writes the migration that seeds the two legal pages from the Markdown next
// to this file. Run once; the migration holds the output, this keeps it
// reviewable and repeatable.
//   bun apps/cms/scripts/seed-legal-pages.ts packages/db/migrations/00NN_legal-pages-seed.sql
import { readFileSync, writeFileSync } from 'node:fs';
import { markdownToRichText } from '@ll/content';

const out = process.argv[2];
if (!out) throw new Error('Pass the migration file to write.');

const pages = [
  {
    id: 'legal_privacy',
    slug: 'privacy',
    title: 'Privacy policy',
    seoDescription:
      'How Living Legacy collects, holds, uses and discloses personal information, in line with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.',
  },
  {
    id: 'legal_terms',
    slug: 'terms-and-conditions',
    title: 'Terms and conditions',
    seoDescription:
      'Terms and conditions and the customer waiver for the Wellington Dam Memorial Forest conservation zone.',
  },
];

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const now = Date.now();

const statements = pages.flatMap((p) => {
  const body = markdownToRichText(
    readFileSync(new URL(`./legal-pages/${p.slug}.md`, import.meta.url), 'utf8')
  );
  const snapshot = { title: p.title, body, seoDescription: p.seoDescription };
  return [
    `INSERT INTO legal_pages (id, slug, title, body, seo_description, status, published_at, last_published_at, created_at, updated_at) VALUES (${q(p.id)}, ${q(p.slug)}, ${q(p.title)}, ${q(JSON.stringify(body))}, ${q(p.seoDescription)}, 'published', ${now}, ${now}, ${now}, ${now});`,
    `INSERT INTO revisions (id, entity_type, entity_id, snapshot, created_at) VALUES (${q(`${p.id}_r1`)}, 'legal_page', ${q(p.id)}, ${q(JSON.stringify(snapshot))}, ${now});`,
  ];
});

writeFileSync(out, `${statements.join('\n--> statement-breakpoint\n')}\n`);
console.log(`Wrote ${statements.length} statements to ${out}`);
```

- [ ] **Step 5: Generate the custom migration, fill it, apply it**

```sh
bun run --filter @ll/db generate -- --custom --name legal-pages-seed
bun apps/cms/scripts/seed-legal-pages.ts packages/db/migrations/<the new file>.sql
bun run --filter @ll/cms db:migrate:local
```

Expected: "Wrote 4 statements"; the local migrate applies it. Check with
`bunx wrangler d1 execute DB --local --command "select slug, status, length(body) from legal_pages"` run from `apps/cms`: two rows, both `published`.

- [ ] **Step 6: Commit**

```bash
bunx prettier --write apps/cms/scripts apps/cms/src/server/legal-seed.test.ts
git add apps/cms/scripts apps/cms/src/server/legal-seed.test.ts packages/db/migrations
git commit -m "feat(db): seed the privacy and terms pages from today's text"
```

---

### Task 3: Database work for legal pages

**Files:**

- Create: `apps/cms/src/server/legal-page-store.ts`, `apps/cms/src/server/legal-page-store.integration.test.ts`

**Interfaces:**

- Consumes: Task 1's `legalPages`, `LegalSlug`, `LegalValues`, `legalPublishErrors`, `legalPath`; `revisions`, `publishEvents`, `user` from `@ll/db/schema`; `logActivity` from `./activity-log`.
- Produces:

```ts
export type LegalPageRow = typeof legalPages.$inferSelect;
export type Actor = { id: string; name: string };
export function currentValues(row: LegalPageRow): LegalValues; // the draft if there is one, else live
export function loadLegalPage(db: Db, slug: LegalSlug): Promise<LegalPageRow>;
export function listLegalPageSummaries(db: Db): Promise<LegalPageSummary[]>;
export type LegalPageSummary = {
  slug: LegalSlug;
  title: string;
  hasDraft: boolean;
  reviewRequestedAt: number | null;
  lastPublishedAt: number | null;
};
export function saveLegalDraft(
  db: Db,
  slug: LegalSlug,
  values: LegalValues,
  expectedUpdatedAt: number,
  actor: Actor
): Promise<{ updatedAt: number }>;
export function requestLegalReview(
  db: Db,
  slug: LegalSlug,
  actor: Actor
): Promise<{ updatedAt: number; reviewRequestedAt: number }>;
export function publishLegalDraft(
  db: Db,
  slug: LegalSlug,
  expectedUpdatedAt: number,
  actor: Actor
): Promise<{ updatedAt: number; lastPublishedAt: number }>;
export function discardLegalDraft(
  db: Db,
  slug: LegalSlug,
  actor: Actor
): Promise<{ updatedAt: number }>;
export function listLegalHistory(
  db: Db,
  pageId: string
): Promise<{ id: string; createdAt: number; by: string | null }[]>;
export function loadLegalRevision(
  db: Db,
  revisionId: string
): Promise<LegalValues & { createdAt: number }>;
export function listLegalReviewRequests(
  db: Db
): Promise<{ slug: LegalSlug; title: string; at: number }[]>;
```

- [ ] **Step 1: Write the failing tests**

`apps/cms/src/server/legal-page-store.integration.test.ts`:

```ts
import { activityLog, legalPages, publishEvents, revisions } from '@ll/db/schema';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import {
  discardLegalDraft,
  listLegalHistory,
  listLegalReviewRequests,
  loadLegalPage,
  loadLegalRevision,
  publishLegalDraft,
  requestLegalReview,
  saveLegalDraft,
} from './legal-page-store';

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const values = (text: string) => ({ title: 'Privacy policy', body: doc(text), seoDescription: '' });

let actor = { id: '', name: 'Sam Tester' };
const version = async () => (await loadLegalPage(testDb(), 'privacy')).updatedAt.getTime();

describe('legal pages', () => {
  beforeEach(async () => {
    const db = testDb();
    // The seed migration made both rows; put privacy back to "no pending edits".
    await db.update(legalPages).set({ draft: null, reviewRequestedAt: null });
    await db.delete(publishEvents);
    await db.delete(activityLog);
    await db.delete(revisions).where(eq(revisions.entityType, 'legal_page'));
    actor = { id: await addUser('admin'), name: 'Sam Tester' };
  });

  it('saves edits as a draft without changing the live text', async () => {
    const before = await loadLegalPage(testDb(), 'privacy');
    await saveLegalDraft(testDb(), 'privacy', values('New wording'), await version(), actor);
    const after = await loadLegalPage(testDb(), 'privacy');
    expect(after.body).toEqual(before.body);
    expect(after.draft).toMatchObject({ body: doc('New wording') });
  });

  it('refuses a save from an out-of-date editor', async () => {
    const stale = await version();
    await saveLegalDraft(testDb(), 'privacy', values('First'), stale, actor);
    await expect(
      saveLegalDraft(testDb(), 'privacy', values('Second'), stale, actor)
    ).rejects.toThrow('Someone else saved this page');
  });

  it('publishes the draft and records it', async () => {
    await saveLegalDraft(testDb(), 'privacy', values('Published wording'), await version(), actor);
    await requestLegalReview(testDb(), 'privacy', actor);
    const { lastPublishedAt } = await publishLegalDraft(
      testDb(),
      'privacy',
      await version(),
      actor
    );

    const row = await loadLegalPage(testDb(), 'privacy');
    expect(row.body).toEqual(doc('Published wording'));
    expect(row.draft).toBeNull();
    expect(row.reviewRequestedAt).toBeNull();
    expect(row.lastPublishedAt?.getTime()).toBe(lastPublishedAt);

    const history = await listLegalHistory(testDb(), row.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.by).toBe('Sam Tester');
    expect((await loadLegalRevision(testDb(), history[0]!.id)).body).toEqual(
      doc('Published wording')
    );

    const events = await testDb().select().from(publishEvents);
    expect(events).toEqual([
      expect.objectContaining({ entityType: 'legal_page', paths: ['/privacy/'] }),
    ]);
    const logged = await testDb()
      .select()
      .from(activityLog)
      .where(
        and(eq(activityLog.action, 'legal_page.published'), eq(activityLog.actorId, actor.id))
      );
    expect(logged).toHaveLength(1);
  });

  it('refuses to publish with no changes', async () => {
    await expect(publishLegalDraft(testDb(), 'privacy', await version(), actor)).rejects.toThrow(
      'There are no changes to publish.'
    );
  });

  it('refuses to publish an empty page', async () => {
    await saveLegalDraft(
      testDb(),
      'privacy',
      { title: 'Privacy policy', body: null, seoDescription: '' },
      await version(),
      actor
    );
    await expect(publishLegalDraft(testDb(), 'privacy', await version(), actor)).rejects.toThrow(
      'Add the page text before publishing.'
    );
  });

  it('refuses a publish from an out-of-date editor', async () => {
    const stale = await version();
    await saveLegalDraft(testDb(), 'privacy', values('Draft'), stale, actor);
    await expect(publishLegalDraft(testDb(), 'privacy', stale, actor)).rejects.toThrow(
      'Someone else saved this page'
    );
  });

  it('discarding drops the draft and the review request', async () => {
    await saveLegalDraft(testDb(), 'privacy', values('Draft'), await version(), actor);
    await requestLegalReview(testDb(), 'privacy', actor);
    await discardLegalDraft(testDb(), 'privacy', actor);
    const row = await loadLegalPage(testDb(), 'privacy');
    expect(row.draft).toBeNull();
    expect(row.reviewRequestedAt).toBeNull();
  });

  it('lists review requests for the bell', async () => {
    await saveLegalDraft(testDb(), 'privacy', values('Draft'), await version(), actor);
    await requestLegalReview(testDb(), 'privacy', actor);
    expect(await listLegalReviewRequests(testDb())).toEqual([
      expect.objectContaining({ slug: 'privacy', title: 'Privacy policy' }),
    ]);
  });

  it('refuses a review request with nothing to review', async () => {
    await expect(requestLegalReview(testDb(), 'privacy', actor)).rejects.toThrow(
      'Save your changes before asking for a review.'
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bun run --filter @ll/cms test:integration -- legal-page-store`
Expected: FAIL, `Cannot find module './legal-page-store'`.

- [ ] **Step 3: Implement**

`apps/cms/src/server/legal-page-store.ts`:

```ts
// Database work for the legal pages, shared by the server functions and the
// integration tests. The typed columns are the live version; edits wait in
// `draft` until an admin publishes them.
import { type LegalSlug, type LegalValues, legalPath, legalPublishErrors } from '@ll/content';
import type { Db } from '@ll/db';
import { legalPages, publishEvents, revisions, user } from '@ll/db/schema';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { logActivity } from './activity-log';

export type LegalPageRow = typeof legalPages.$inferSelect;
export type Actor = { id: string; name: string };
export type LegalPageSummary = {
  slug: LegalSlug;
  title: string;
  hasDraft: boolean;
  reviewRequestedAt: number | null;
  lastPublishedAt: number | null;
};

function conflictError() {
  return new Error(
    'Someone else saved this page while you were editing. Reload to see their changes.'
  );
}

export function currentValues(row: LegalPageRow): LegalValues {
  const draft = row.draft as LegalValues | null;
  return (
    draft ?? {
      title: row.title,
      body: row.body as LegalValues['body'],
      seoDescription: row.seoDescription ?? '',
    }
  );
}

export async function loadLegalPage(db: Db, slug: LegalSlug) {
  const row = await db.query.legalPages.findFirst({ where: eq(legalPages.slug, slug) });
  if (!row) throw new Error('This page does not exist.');
  return row;
}

function assertVersion(row: LegalPageRow, expectedUpdatedAt: number) {
  if (row.updatedAt.getTime() !== expectedUpdatedAt) throw conflictError();
}

export async function listLegalPageSummaries(db: Db): Promise<LegalPageSummary[]> {
  const rows = await db.select().from(legalPages).orderBy(legalPages.slug);
  return rows.map((r) => ({
    slug: r.slug as LegalSlug,
    title: currentValues(r).title,
    hasDraft: r.draft !== null,
    reviewRequestedAt: r.reviewRequestedAt?.getTime() ?? null,
    lastPublishedAt: r.lastPublishedAt?.getTime() ?? null,
  }));
}

export async function saveLegalDraft(
  db: Db,
  slug: LegalSlug,
  values: LegalValues,
  expectedUpdatedAt: number,
  actor: Actor
) {
  const row = await loadLegalPage(db, slug);
  assertVersion(row, expectedUpdatedAt);
  const now = new Date();
  await db
    .update(legalPages)
    .set({ draft: values, updatedAt: now, updatedBy: actor.id })
    .where(eq(legalPages.id, row.id));
  return { updatedAt: now.getTime() };
}

export async function requestLegalReview(db: Db, slug: LegalSlug, actor: Actor) {
  const row = await loadLegalPage(db, slug);
  if (!row.draft) throw new Error('Save your changes before asking for a review.');
  const now = new Date();
  await db.batch([
    db
      .update(legalPages)
      .set({ reviewRequestedAt: now, updatedAt: now, updatedBy: actor.id })
      .where(eq(legalPages.id, row.id)),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'legal_page.review_requested',
      summary: `Asked for a review of ${currentValues(row).title}`,
    }),
  ]);
  return { updatedAt: now.getTime(), reviewRequestedAt: now.getTime() };
}

export async function publishLegalDraft(
  db: Db,
  slug: LegalSlug,
  expectedUpdatedAt: number,
  actor: Actor
) {
  const row = await loadLegalPage(db, slug);
  assertVersion(row, expectedUpdatedAt);
  if (!row.draft) throw new Error('There are no changes to publish.');
  const values = currentValues(row);
  const errors = legalPublishErrors(values);
  if (errors.length) throw new Error(errors.join(' '));

  const now = new Date();
  await db.batch([
    db
      .update(legalPages)
      .set({
        title: values.title,
        body: values.body,
        seoDescription: values.seoDescription || null,
        draft: null,
        status: 'published',
        reviewRequestedAt: null,
        lastPublishedAt: now,
        publishedAt: row.publishedAt ?? now,
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(legalPages.id, row.id)),
    db.insert(revisions).values({
      entityType: 'legal_page',
      entityId: row.id,
      snapshot: values,
      createdBy: actor.id,
      createdAt: now,
    }),
    db.insert(publishEvents).values({
      entityType: 'legal_page',
      entityId: row.id,
      action: 'publish',
      paths: [legalPath(slug)],
    }),
    logActivity(db, {
      actorId: actor.id,
      actorName: actor.name,
      action: 'legal_page.published',
      summary: `Published ${values.title}`,
    }),
  ]);
  return { updatedAt: now.getTime(), lastPublishedAt: now.getTime() };
}

export async function discardLegalDraft(db: Db, slug: LegalSlug, actor: Actor) {
  const row = await loadLegalPage(db, slug);
  const now = new Date();
  await db
    .update(legalPages)
    .set({ draft: null, reviewRequestedAt: null, updatedAt: now, updatedBy: actor.id })
    .where(eq(legalPages.id, row.id));
  return { updatedAt: now.getTime() };
}

export async function listLegalHistory(db: Db, pageId: string) {
  const rows = await db
    .select({ id: revisions.id, createdAt: revisions.createdAt, by: user.name })
    .from(revisions)
    .leftJoin(user, eq(user.id, revisions.createdBy))
    .where(and(eq(revisions.entityType, 'legal_page'), eq(revisions.entityId, pageId)))
    .orderBy(desc(revisions.createdAt));
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt.getTime(), by: r.by }));
}

export async function loadLegalRevision(db: Db, revisionId: string) {
  const row = await db.query.revisions.findFirst({
    where: and(eq(revisions.id, revisionId), eq(revisions.entityType, 'legal_page')),
  });
  if (!row) throw new Error('That version could not be found.');
  return { ...(row.snapshot as LegalValues), createdAt: row.createdAt.getTime() };
}

export async function listLegalReviewRequests(db: Db) {
  const rows = await db
    .select()
    .from(legalPages)
    .where(isNotNull(legalPages.reviewRequestedAt))
    .orderBy(desc(legalPages.reviewRequestedAt));
  return rows.map((r) => ({
    slug: r.slug as LegalSlug,
    title: currentValues(r).title,
    at: r.reviewRequestedAt!.getTime(),
  }));
}
```

If `db.query.legalPages` is undefined, the schema export is not picked up by `createDb`: check `packages/db/src/index.ts` builds its schema from `./schema` (it does for `posts`), and that `legalPages` is exported from `schema/content.ts`.

- [ ] **Step 4: Run the tests**

Run: `bun run --filter @ll/cms test:integration -- legal-page-store`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
bunx prettier --write apps/cms/src/server/legal-page-store*.ts
git add apps/cms/src/server/legal-page-store*.ts
git commit -m "feat(cms): draft, review and publish for legal pages"
```

---

### Task 4: Server functions and the bell

**Files:**

- Create: `apps/cms/src/server/legal-pages.ts`
- Modify: `apps/cms/src/server/notifications.ts`, `apps/cms/src/components/shell/notifications.tsx`

**Interfaces:**

- Consumes: everything Task 3 produces; `requirePermission`, `authMiddleware` from `@/lib/session`; `getDb` from `@/lib/db`.
- Produces (server functions, all `{ data }` in):
  - `listLegalPages()` → `LegalPageSummary[]`
  - `getLegalPageEditorData({ slug })` → `{ id, slug, values: LegalValues, hasDraft, updatedAt: number, reviewRequestedAt: number | null, lastPublishedAt: number | null, history: { id, createdAt, by }[] }`
  - `saveLegalPage({ slug, values, expectedUpdatedAt })` → `{ updatedAt }`
  - `requestLegalPageReview({ slug })` → `{ updatedAt, reviewRequestedAt }`
  - `publishLegalPage({ slug, expectedUpdatedAt })` → `{ updatedAt, lastPublishedAt }`
  - `discardLegalPageDraft({ slug })` → `{ updatedAt }`
  - `getLegalRevision({ id })` → `LegalValues & { createdAt }`
  - `getLegalPagePreview({ slug })` → `{ title, body, hasDraft }`
  - Notification kind `'legal_review'` with `slug`.

- [ ] **Step 1: Write the server functions**

`apps/cms/src/server/legal-pages.ts`:

```ts
import { legalSlugSchema, legalValuesSchema } from '@ll/content';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import {
  currentValues,
  discardLegalDraft,
  listLegalHistory,
  listLegalPageSummaries,
  loadLegalPage,
  loadLegalRevision,
  publishLegalDraft,
  requestLegalReview,
  saveLegalDraft,
} from './legal-page-store';

const slugInput = z.object({ slug: legalSlugSchema });
const actorOf = (user: { id: string; name: string }) => ({ id: user.id, name: user.name });

export const listLegalPages = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .handler(() => listLegalPageSummaries(getDb()));

export const getLegalPageEditorData = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput)
  .handler(async ({ data }) => {
    const db = getDb();
    const row = await loadLegalPage(db, data.slug);
    return {
      id: row.id,
      slug: data.slug,
      values: currentValues(row),
      hasDraft: row.draft !== null,
      updatedAt: row.updatedAt.getTime(),
      reviewRequestedAt: row.reviewRequestedAt?.getTime() ?? null,
      lastPublishedAt: row.lastPublishedAt?.getTime() ?? null,
      history: await listLegalHistory(db, row.id),
    };
  });

export type LegalPageEditorData = Awaited<ReturnType<typeof getLegalPageEditorData>>;

export const saveLegalPage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput.extend({ values: legalValuesSchema, expectedUpdatedAt: z.number() }))
  .handler(({ data, context }) =>
    saveLegalDraft(getDb(), data.slug, data.values, data.expectedUpdatedAt, actorOf(context.user))
  );

export const requestLegalPageReview = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')])
  .validator(slugInput)
  .handler(({ data, context }) => requestLegalReview(getDb(), data.slug, actorOf(context.user)));

export const publishLegalPage = createServerFn({ method: 'POST' })
  .middleware([requirePermission('legal:publish')])
  .validator(slugInput.extend({ expectedUpdatedAt: z.number() }))
  .handler(({ data, context }) =>
    publishLegalDraft(getDb(), data.slug, data.expectedUpdatedAt, actorOf(context.user))
  );

export const discardLegalPageDraft = createServerFn({ method: 'POST' })
  .middleware([requirePermission('legal:publish')])
  .validator(slugInput)
  .handler(({ data, context }) => discardLegalDraft(getDb(), data.slug, actorOf(context.user)));

export const getLegalRevision = createServerFn({ method: 'GET' })
  .middleware([requirePermission('content:write')])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(({ data }) => loadLegalRevision(getDb(), data.id));

export const getLegalPagePreview = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(slugInput)
  .handler(async ({ data }) => {
    const row = await loadLegalPage(getDb(), data.slug);
    const values = currentValues(row);
    return { title: values.title, body: values.body, hasDraft: row.draft !== null };
  });
```

`context.user` comes from the session middleware; check `requirePermission` in `apps/cms/src/lib/session.ts` puts `user` on `context` the same way `posts.ts` uses it.

- [ ] **Step 2: Add review requests to the bell**

In `apps/cms/src/server/notifications.ts`, import `listLegalReviewRequests` from `./legal-page-store`, add a third entry to the `Promise.all`:

```ts
      can(role, 'legal:publish') ? listLegalReviewRequests(db) : [],
```

destructure it as `legalReviews`, and add to the returned array:

```ts
      ...legalReviews.map((r) => ({
        id: `legal-review:${r.slug}`,
        kind: 'legal_review' as const,
        slug: r.slug,
        title: r.title,
        at: r.at,
      })),
```

Update the doc comment's list with "legal pages waiting for an admin to publish them".

In `apps/cms/src/components/shell/notifications.tsx`, the row currently branches `item.kind === 'review' ? … : …`. Make it three-way: keep `review` and the booking branch, and add before the booking branch:

```tsx
            ) : item.kind === 'legal_review' ? (
              <Link
                to="/legal/$slug"
                params={{ slug: item.slug }}
                onClick={onNavigate}
                className={rowClass}
              >
                <PencilLineIcon aria-hidden />
                <span className={textClass}>
                  <span className="text-muted-foreground">Review </span>
                  <span className="font-medium">{item.title}</span>
                  <span className={metaClass}>Asked {formatRelative(item.at)}</span>
                </span>
                {dot}
              </Link>
```

The `/legal/$slug` route is created in Task 5; type-check passes once it exists, so run type-check at the end of Task 5.

- [ ] **Step 3: Commit**

```bash
bunx prettier --write apps/cms/src/server/legal-pages.ts apps/cms/src/server/notifications.ts apps/cms/src/components/shell/notifications.tsx
git add apps/cms/src/server apps/cms/src/components/shell/notifications.tsx
git commit -m "feat(cms): legal page server functions and review notifications"
```

---

### Task 5: CMS screens

**Files:**

- Create: `apps/cms/src/routes/_app/legal/index.tsx`, `apps/cms/src/routes/_app/legal/$slug.tsx`, `apps/cms/src/routes/preview/legal/$slug.tsx`, `apps/cms/src/components/legal/legal-pages-list.tsx`, `apps/cms/src/components/legal/legal-page-editor.tsx`, `apps/cms/src/components/legal/legal-history.tsx`
- Modify: `apps/cms/src/lib/nav.ts`

**Interfaces:**

- Consumes: Task 4's server functions and `LegalPageEditorData`; `DocumentEditor` (lazy, from `@/components/posts/post-editor/document-editor`, props `title`, `onTitleChange`, `body`, `onBodyChange`, `readOnly`); `DocumentEditorSkeleton`; `PostPreviewBody` from `@/components/posts/post-preview` (`{ body: RichTextDoc | null }`); `useAction` from `@/lib/use-action`; `formatDate` from `@/lib/format`; `useTimeZone` from `@/lib/use-time-zone`.

- [ ] **Step 1: Sidebar**

In `apps/cms/src/lib/nav.ts`, add `| '/legal'` to the `to` union, and in the About group after FAQs:

```ts
      { title: 'Legal pages', icon: FileText, to: '/legal', permission: 'content:write' },
```

(`FileText` is already imported there.)

- [ ] **Step 2: List route and component**

`apps/cms/src/routes/_app/legal/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { LegalPagesList } from '@/components/legal/legal-pages-list';
import { listLegalPages } from '@/server/legal-pages';

export const Route = createFileRoute('/_app/legal/')({
  loader: () => listLegalPages(),
  head: () => ({ meta: [{ title: 'Legal pages | Living Legacy CMS' }] }),
  component: () => <LegalPagesList pages={Route.useLoaderData()} />,
});
```

`apps/cms/src/components/legal/legal-pages-list.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import type { LegalPageSummary } from '@/server/legal-page-store';

// Two fixed pages, so a plain list rather than the list-page building blocks
// (no selection, no deleting, nothing to search).
export function LegalPagesList({ pages }: { pages: LegalPageSummary[] }) {
  const timeZone = useTimeZone();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 data-slot="page-title" className="text-xl font-semibold">
          Legal pages
        </h1>
        <p className="text-muted-foreground text-ui mt-1">
          Changes go live when an admin publishes them. Every published version is kept.
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link
              to="/legal/$slug"
              params={{ slug: page.slug }}
              className="hover:bg-muted/50 touch:min-h-11 flex items-center gap-3 px-4 py-3"
            >
              <span className="flex-1">
                <span className="text-ui block font-medium">{page.title}</span>
                <span className="text-muted-foreground block text-xs">
                  {page.lastPublishedAt
                    ? `Last updated ${formatDate(page.lastPublishedAt, timeZone)}`
                    : 'Not published'}
                </span>
              </span>
              {page.reviewRequestedAt ? (
                <Badge variant="secondary">Review requested</Badge>
              ) : page.hasDraft ? (
                <Badge variant="outline">Unpublished changes</Badge>
              ) : (
                <Badge variant="outline">Published</Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Check `formatDate`'s signature in `apps/cms/src/lib/format.ts` and adjust the two calls (in this file and in Steps 3 and 4) to match it.

- [ ] **Step 3: Editor route and component**

`apps/cms/src/routes/_app/legal/$slug.tsx`:

```tsx
import { can, legalSlugSchema } from '@ll/content';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { LegalPageEditor } from '@/components/legal/legal-page-editor';
import { getLegalPageEditorData } from '@/server/legal-pages';

export const Route = createFileRoute('/_app/legal/$slug')({
  loader: ({ params }) => {
    const slug = legalSlugSchema.safeParse(params.slug);
    if (!slug.success) throw notFound();
    return getLegalPageEditorData({ data: { slug: slug.data } });
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.values.title ?? 'Legal page'} | Living Legacy CMS` }],
  }),
  component: LegalPageRoute,
});

function LegalPageRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return (
    <LegalPageEditor
      key={`${data.slug}:${data.updatedAt}`}
      data={data}
      canPublish={can(user.role, 'legal:publish')}
    />
  );
}
```

`apps/cms/src/components/legal/legal-page-editor.tsx`:

```tsx
import type { LegalValues } from '@ll/content';
import { ClientOnly, useRouter } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, useState } from 'react';
import { DocumentEditorSkeleton } from '@/components/posts/post-editor/document-editor-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import {
  type LegalPageEditorData,
  discardLegalPageDraft,
  publishLegalPage,
  requestLegalPageReview,
  saveLegalPage,
} from '@/server/legal-pages';
import { LegalHistory } from './legal-history';

const DocumentEditor = lazy(() =>
  import('@/components/posts/post-editor/document-editor').then((m) => ({
    default: m.DocumentEditor,
  }))
);

export function LegalPageEditor({
  data,
  canPublish,
}: {
  data: LegalPageEditorData;
  canPublish: boolean;
}) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const { run, pending } = useAction();
  const [values, setValues] = useState<LegalValues>(data.values);
  const [version, setVersion] = useState(data.updatedAt);
  const [dirty, setDirty] = useState(false);
  const update = (patch: Partial<LegalValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
  };

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(): Promise<number | undefined> {
    const result = await run(
      () => saveLegalPage({ data: { slug: data.slug, values, expectedUpdatedAt: version } }),
      {
        success: {
          title: 'Changes saved',
          description: 'They go live when an admin publishes them.',
        },
        error: 'Could not save the changes',
      }
    );
    if (result === undefined) return undefined;
    setVersion(result.updatedAt);
    setDirty(false);
    return result.updatedAt;
  }

  // Publishes what is on screen: unsaved edits are saved first.
  async function publish() {
    const current = dirty ? await save() : version;
    if (current === undefined) return;
    await run(() => publishLegalPage({ data: { slug: data.slug, expectedUpdatedAt: current } }), {
      success: { title: 'Published', description: 'The website shows this version now.' },
      error: 'Could not publish',
    });
  }

  async function askForReview() {
    if (dirty && (await save()) === undefined) return;
    await run(() => requestLegalPageReview({ data: { slug: data.slug } }), {
      success: {
        title: 'Review requested',
        description: 'Admins can see it in their notifications.',
      },
      error: 'Could not ask for a review',
    });
  }

  async function discard() {
    await run(() => discardLegalPageDraft({ data: { slug: data.slug } }), {
      success: {
        title: 'Changes discarded',
        description: 'The page is back to the published version.',
      },
      error: 'Could not discard the changes',
    });
  }

  const hasChanges = data.hasDraft || dirty;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 data-slot="page-title" className="mr-auto text-xl font-semibold">
            {data.values.title}
          </h1>
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/preview/legal/${data.slug}`} target="_blank" rel="noreferrer" />}
          >
            Preview
          </Button>
          <Button variant="outline" size="sm" disabled={pending || !dirty} onClick={save}>
            Save
          </Button>
          {canPublish ? (
            <>
              {data.hasDraft && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={discard}>
                  Discard changes
                </Button>
              )}
              <Button size="sm" disabled={pending || !hasChanges} onClick={publish}>
                {pending ? <Spinner /> : null}
                Publish
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={pending || !hasChanges || data.reviewRequestedAt !== null}
              onClick={askForReview}
            >
              {pending ? <Spinner /> : null}
              {data.reviewRequestedAt ? 'Review requested' : 'Ask for review'}
            </Button>
          )}
        </div>
        <div className="bg-background min-h-[32rem] rounded-lg border">
          <ClientOnly fallback={<DocumentEditorSkeleton />}>
            <Suspense fallback={<DocumentEditorSkeleton />}>
              <DocumentEditor
                title={values.title}
                onTitleChange={(title) => update({ title })}
                body={values.body}
                onBodyChange={(body) => update({ body })}
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <aside className="text-ui space-y-6">
        <div className="space-y-1">
          {data.reviewRequestedAt ? (
            <Badge variant="secondary">Review requested</Badge>
          ) : hasChanges ? (
            <Badge variant="outline">Unpublished changes</Badge>
          ) : (
            <Badge variant="outline">Published</Badge>
          )}
          <p className="text-muted-foreground text-xs">
            {data.lastPublishedAt
              ? `Last updated ${formatDate(data.lastPublishedAt, timeZone)}`
              : 'Not published yet'}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="legal-seo">Search description</Label>
          <Textarea
            id="legal-seo"
            rows={3}
            maxLength={300}
            value={values.seoDescription}
            onChange={(e) => update({ seoDescription: e.target.value })}
          />
        </div>
        <LegalHistory history={data.history} />
      </aside>
    </div>
  );
}
```

`useAction`'s `run` refreshes the route loader after success; the route's `key` includes `updatedAt`, so the editor remounts with the published state. Check `run`'s options shape against `apps/cms/src/lib/use-action.ts` and match it (the media page calls it with `{ success: { title, description }, error }`).

If `Button` does not take a `render` prop for a link in this codebase, use `<a className={buttonVariants({ variant: 'outline', size: 'sm' })} …>` with `buttonVariants` from `@/components/ui/button`.

- [ ] **Step 4: History dialog**

`apps/cms/src/components/legal/legal-history.tsx`:

```tsx
import type { LegalValues } from '@ll/content';
import { useState } from 'react';
import { PostPreviewBody } from '@/components/posts/post-preview';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/format';
import { notify } from '@/lib/notify';
import { useTimeZone } from '@/lib/use-time-zone';
import { getLegalRevision } from '@/server/legal-pages';

type Entry = { id: string; createdAt: number; by: string | null };

/** Every published version, newest first, each readable as it was. */
export function LegalHistory({ history }: { history: Entry[] }) {
  const timeZone = useTimeZone();
  const [open, setOpen] = useState<(LegalValues & { createdAt: number }) | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function show(id: string) {
    setLoading(id);
    try {
      setOpen(await getLegalRevision({ data: { id } }));
    } catch (error) {
      notify.error('Could not open that version', error);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-ui font-medium">History</h2>
      {history.length === 0 ? (
        <p className="text-muted-foreground text-xs">No published versions yet.</p>
      ) : (
        <ul className="space-y-1">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="flex-1 text-xs">
                {formatDate(entry.createdAt, timeZone)}
                {entry.by ? ` · ${entry.by}` : ''}
              </span>
              <Button
                variant="ghost"
                size="xs"
                disabled={loading !== null}
                onClick={() => show(entry.id)}
              >
                {loading === entry.id ? <Spinner /> : 'View'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>
              {open ? `As published on ${formatDate(open.createdAt, timeZone)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {open && <PostPreviewBody body={open.body} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: Preview route**

`apps/cms/src/routes/preview/legal/$slug.tsx`:

```tsx
import { legalSlugSchema } from '@ll/content';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { PostPreviewBody } from '@/components/posts/post-preview';
import { getCurrentUser } from '@/lib/session';
import { getLegalPagePreview } from '@/server/legal-pages';

export const Route = createFileRoute('/preview/legal/$slug')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' });
  },
  loader: ({ params }) => {
    const slug = legalSlugSchema.safeParse(params.slug);
    if (!slug.success) throw notFound();
    return getLegalPagePreview({ data: { slug: slug.data } });
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Preview: ${loaderData?.title ?? 'Legal page'} | Living Legacy CMS` }],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const page = Route.useLoaderData();
  return (
    <div className="bg-background min-h-svh">
      <div className="bg-background/80 text-ui sticky top-0 z-10 flex h-11 items-center gap-3 border-b px-4 backdrop-blur">
        <span className="font-medium">Preview</span>
        <span className="text-muted-foreground">
          {page.hasDraft ? 'Unpublished changes' : 'The published version'}
        </span>
      </div>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight">{page.title}</h1>
        <div className="mt-10">
          <PostPreviewBody body={page.body} />
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 6: Check it**

```sh
bun run type-check && bun run lint
bun run dev:cms
```

On `http://localhost:3100/legal`, at desktop width and at 390px with touch emulation:

- both pages listed as Published with today's "Last updated";
- open Privacy, change a word, Save: badge shows Unpublished changes; Preview shows the change;
- change another word and press Publish **without saving**: the published text includes both words (Review Focus 1); History gains an entry; View shows that version;
- sign in as an editor (or change your role locally): no Publish or Discard; Ask for review works and the admin's bell shows "Review Privacy policy".

- [ ] **Step 7: Commit**

```bash
bunx prettier --write apps/cms/src/lib/nav.ts apps/cms/src/routes/_app/legal apps/cms/src/routes/preview/legal apps/cms/src/components/legal
git add apps/cms/src
git commit -m "feat(cms): legal pages list, editor, history and preview"
```

---

### Task 6: Website reads the published pages

**Files:**

- Create: `apps/web/src/lib/legal-pages.ts`
- Modify: `apps/web/src/pages/privacy.astro`, `apps/web/src/pages/terms-and-conditions.astro`, `apps/web/src/pages/sitemap-pages.xml.ts`

**Interfaces:**

- Consumes: `renderRichText`, `type LegalSlug`, `legalPath` from `@ll/content`; the D1 binding pattern from `apps/web/src/lib/blog-cms.ts`; `BlogHeading` from `@/lib/blog`.
- Produces: `getLegalPage(slug: LegalSlug): Promise<LegalPage | null>`, `type LegalPage = { title: string; html: string; headings: BlogHeading[]; description?: string; lastPublishedAt: number | null }`, `formatLegalDate(ms: number): string`, `getLegalSitemapEntries(): Promise<{ path: string; lastmod?: string }[]>`.

- [ ] **Step 1: Write the reader**

`apps/web/src/lib/legal-pages.ts`:

```ts
// The privacy policy and terms, read from the CMS's database on each request.
// Only the live columns: a draft waiting for an admin never reaches the site.
import { type LegalSlug, legalPath, legalSlugs, renderRichText } from '@ll/content';
import { CMS_URL } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import type { BlogHeading } from '@/lib/blog';

interface D1 {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
    all<T>(): Promise<{ results: T[] }>;
  };
}

const db = (env as { DB?: D1 }).DB;
const MEDIA_ORIGIN = CMS_URL.replace(/\/+$/, '');

type Row = {
  slug: LegalSlug;
  title: string;
  body: string | null;
  seo_description: string | null;
  last_published_at: number | null;
};

export type LegalPage = {
  title: string;
  html: string;
  headings: BlogHeading[];
  description?: string;
  lastPublishedAt: number | null;
};

/** The published page, or null when it is missing or the database cannot be read. */
export async function getLegalPage(slug: LegalSlug): Promise<LegalPage | null> {
  if (!db) return null;
  try {
    const { results } = await db
      .prepare(
        `select slug, title, body, seo_description, last_published_at
           from legal_pages where slug = ? and status = 'published'`
      )
      .bind(slug)
      .all<Row>();
    const row = results[0];
    if (!row) return null;
    const { html, headings } = renderRichText(row.body ? JSON.parse(row.body) : null, {
      mediaOrigin: MEDIA_ORIGIN,
    });
    return {
      title: row.title,
      html,
      headings,
      description: row.seo_description ?? undefined,
      lastPublishedAt: row.last_published_at,
    };
  } catch (error) {
    console.error('[legal] could not read', slug, error);
    return null;
  }
}

/** "5 August 2026", on the Sydney calendar, so a late-evening publish keeps its date. */
export function formatLegalDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  });
}

export async function getLegalSitemapEntries() {
  const pages = await Promise.all(
    legalSlugs.map(async (slug) => ({ slug, page: await getLegalPage(slug) }))
  );
  return pages
    .filter((p) => p.page)
    .map(({ slug, page }) => ({
      path: legalPath(slug),
      lastmod: page!.lastPublishedAt ? new Date(page!.lastPublishedAt).toISOString() : undefined,
    }));
}
```

Check that `renderRichText`'s `headings` items have the same shape as `BlogHeading` (`apps/web/src/lib/blog-cms.ts` passes them straight into `BlogPost.headings`, so they do).

- [ ] **Step 2: Pin the date across midnight**

`apps/web` has no test runner, so check it once by hand:

```sh
cd apps/web && bun -e "
const f = (ms) => new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
console.log(f(Date.UTC(2026, 7, 4, 23, 0)));
"
```

Expected: `5 August 2026` (11pm UTC on 4 August is the morning of 5 August in Sydney).

- [ ] **Step 3: Privacy page**

In `apps/web/src/pages/privacy.astro`:

- Add `export const prerender = false;` and `import { formatLegalDate, getLegalPage } from '@/lib/legal-pages';`.
- Delete the hard-coded `headings` array and the `title` / `description` constants, and add:

```ts
const page = await getLegalPage('privacy');
if (!page) {
  Astro.response.status = 503;
  Astro.response.headers.set('Retry-After', '300');
}
const title = page?.title ?? 'Privacy policy';
const description = page?.description;
const headings = page?.headings ?? [];
```

- In `relatedLocations`, change `name: 'Wellington Dam'` to `name: 'Living Legacy Wellington Dam'` and `name: 'Mornington Green'` to `name: 'Living Legacy Mornington'`. Update the file's top comment to say the policy text now comes from the CMS (Legal pages) and only the header and related-locations block live here.
- Give `BaseLayout` `noindex={!page}`.
- Replace `<h1 class="display-title mt-4">Privacy policy</h1>` with `<h1 class="display-title mt-4">{title}</h1>` and, after it, when `page?.lastPublishedAt` is set: `<p class="text-muted mt-4 text-sm">Last updated {formatLegalDate(page.lastPublishedAt)}</p>` (use the muted text class the header area already uses; check `global.css` for the site's muted token name).
- Replace everything between `<Prose>` and `</Prose>` with:

```astro
{
  page ? (
    <Fragment set:html={page.html} />
  ) : (
    <p>This page is temporarily unavailable. Please try again in a few minutes.</p>
  )
}
```

- [ ] **Step 4: Terms page**

In `apps/web/src/pages/terms-and-conditions.astro`, the same changes with slug `terms-and-conditions` and fallback title `'Terms and conditions'`. Keep the header's lead paragraph, `WAIVER_PDF_HREF` and the waiver download button in the template; only the `<Prose>` contents come from the CMS. Update the top comment the same way, keeping its notes about the PDF transcription and its known slips (they now explain the seed text).

- [ ] **Step 5: Sitemap**

In `apps/web/src/pages/sitemap-pages.xml.ts`, import `getLegalSitemapEntries`, make `GET` async, and build the URL list from the existing fixed paths plus the legal entries:

```ts
const entries = [
  ...PATHS.map((path) => ({ path, lastmod: undefined as string | undefined })),
  ...(await getLegalSitemapEntries()),
];
const urls = entries
  .map(
    ({ path, lastmod }) =>
      `<url><loc>${new URL(path, base).toString()}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  )
  .join('');
```

Update its doc comment to name the legal pages.

- [ ] **Step 6: Check it**

```sh
bun run type-check && bun run --filter @ll/web build
cd apps/web && bunx astro dev --port 4400
```

(Port 4321 may be another project's dev server; use 4400.) Then:

- `/privacy/` and `/terms-and-conditions/` look as before, with "Last updated" under the title and the contents list working;
- in the CMS, save (do not publish) a change to Privacy, reload `/privacy/`: unchanged (Review Focus 3); publish it, reload: changed;
- compare heading ids: `curl -s localhost:4400/privacy/ | grep -o '<h2 id="[^"]*"'` against the ids in the deleted `headings` arrays (`git show HEAD~1:apps/web/src/pages/privacy.astro`). List any changed ids for the PR description (Review Focus 5);
- stop D1 access to simulate failure is not practical locally; instead read the code path once more: `getLegalPage` returns null on any error, and the page sets 503 and `Retry-After`;
- `/sitemap-pages.xml` lists both pages with `lastmod`.

Stop the server with `bunx astro dev stop`.

- [ ] **Step 7: Commit**

```bash
bunx prettier --write apps/web/src/lib/legal-pages.ts apps/web/src/pages/privacy.astro apps/web/src/pages/terms-and-conditions.astro apps/web/src/pages/sitemap-pages.xml.ts
git add apps/web/src
git commit -m "feat(web): privacy and terms read the published text from the CMS"
```

---

### Task 7: Whole-branch check

- [ ] **Step 1: Run what CI runs**

```sh
bun run type-check && bun run lint && bun run format:check && bun run test && bun run build
```

Expected: every step exits 0.

- [ ] **Step 2: Note the follow-ups in the PR description**

- Changed heading ids from Task 6 Step 6, if any.
- The terms page is still the 2018 Wellington Dam event terms (see the page's comment). Editors can now replace it in the CMS; that is the client's call.

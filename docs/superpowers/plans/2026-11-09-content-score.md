# Content score panel implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live content score panel in the CMS post editor: a score out of 100, structure counts against targets, focus keyword and related term usage, and brand language problems.

**Architecture:** A pure analysis engine in `packages/content` (`rich-text-outline.ts` reads the Tiptap JSON, `brand-language.ts` holds the guide's rules, `content-score.ts` runs the checks and the score). The CMS stores a focus keyword and related terms on each post, keeps targets in the existing site settings row, and renders the result in a new side panel section, recomputed 500 ms after typing stops.

**Tech Stack:** Bun monorepo, TypeScript, Zod 4, Drizzle on D1, TanStack Start, React, shadcn on Base UI, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-content-score-design.md`

**Deviations from the spec, decided while planning:**

1. Targets are nine flat number keys in `SITE_SETTINGS_DEFAULTS` (`targetWordsMin`, …), not one `contentTargets` object, because `parseSiteSettings` only keeps keys whose stored type matches a primitive default.
2. `ScoreInput` leaves out `ogMediaId`; no check reads it.
3. `ContentScore.structure` and `.terms` carry their target and state, so the panel does no maths.
4. Content targets get unit tests instead of an integration test. They are stored through the existing settings row, which already works.
5. `publishValues` already adds a 301 when a live post's slug changes. That gap is closed and is not part of the later redirects piece.

## Global constraints

- Run every command from the repo root. Tests are Vitest (`bun run --filter <pkg> test`).
- Never import `@ll/db` values into a component. Import icons from `@/components/icons` only.
- User-facing copy: Australian English, sentence case, no em or en dashes, no exclamation marks.
- No new dependencies.
- Conventional Commits, header at most 100 characters, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Format what you touch: `bunx prettier --write <paths>`.
- Never edit a migration that has shipped; add a new one.
- Tappable controls are at least 44pt on touch screens (`touch:min-h-11`, or `touch:size-8` and up for icon buttons). Nothing relies on hover.
- The score is advice. It never blocks saving or publishing.
- `apps/web` does not change.

## Review focus

1. **Drafts and revisions saved before these fields existed.** Restoring an old revision must still parse. Covered by the `postInputSchema` default test in Task 1.
2. **Pasted content with odd shapes** (tables, an image inside a paragraph, malformed nodes). No throw, sensible counts. Covered by the outline tests in Task 3.
3. **Keywords with punctuation or symbols** ("C++", "!!!", "ashes (cremated)"). No regex crash, and the slug check does not pass by accident. Covered by tests in Tasks 3 and 5.
4. **A brand new post with no body.** The score is a whole number with no NaN, and the body checks are skipped. Covered by a test in Task 5.
5. **Settings where a minimum exceeds its maximum.** The server refuses them and the form says why. Covered by the `contentTargetProblem` test in Task 2.

---

## File structure

| File                                                                                      | Responsibility                                                                  |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/db/src/schema/content.ts`, `packages/db/migrations/0021_post_focus_keyword.sql` | Two new `posts` columns                                                         |
| `packages/content/src/posts.ts`                                                           | Schema fields, limits, `uniqueTerms`                                            |
| `packages/content/src/settings.ts`                                                        | Target defaults, `ContentTargets`, `contentTargetsFrom`, `contentTargetProblem` |
| `packages/content/src/rich-text-outline.ts`                                               | One walk over Tiptap JSON; word, sentence and phrase helpers                    |
| `packages/content/src/brand-language.ts`                                                  | Brand rules and `findBrandProblems`                                             |
| `packages/content/src/content-score.ts`                                                   | Types, `guidelinesFromSettings`, `analysePost`, `scoreChecks`                   |
| `apps/cms/src/server/post-store.ts`, `posts.ts`, `settings.ts`                            | Save and load the new fields and targets                                        |
| `apps/cms/src/components/posts/post-editor/terms-input.tsx`                               | Chip input for related terms                                                    |
| `apps/cms/src/components/posts/post-editor/content-score/*`                               | The panel: hook, gauge, panel, check list, colours                              |
| `apps/cms/src/components/settings/settings-page.tsx`                                      | The Content targets section                                                     |

---

### Task 1: Store a focus keyword and related terms on posts

**Files:**

- Modify: `packages/db/src/schema/content.ts` (the `posts` table, after `noindex`)
- Create: `packages/db/migrations/0021_post_focus_keyword.sql` (generated)
- Modify: `packages/content/src/posts.ts`
- Modify: `apps/cms/src/server/post-store.ts` (`liveInput`, `columnWrites`)
- Modify: `apps/cms/src/server/posts.ts` (`seoSchema`, `savePostSeo`)
- Modify: `apps/cms/src/components/posts/post-editor/use-post-editor.ts` (`saveSeo`)
- Modify: `apps/cms/src/server/api-v1.test.ts` (the `base: PostInput` literal)
- Test: `packages/content/src/posts.test.ts`, `apps/cms/src/server/post-store.integration.test.ts` (new)

**Interfaces:**

- Produces: `PostInput.focusKeyword: string`, `PostInput.relatedTerms: string[]`; constants `FOCUS_KEYWORD_LIMIT = 80`, `RELATED_TERM_LIMIT = 60`, `RELATED_TERMS_MAX = 10`; `uniqueTerms(terms: string[]): string[]`; columns `posts.focusKeyword: string | null`, `posts.relatedTerms: string[]`.

- [ ] **Step 1: Write the failing schema tests.** Append to `packages/content/src/posts.test.ts`, adding `PostInput` and `emptyPostInput` to its existing import from `./posts` if they are not there:

```ts
describe('postInputSchema focus keyword and related terms', () => {
  it('fills both for input saved before they existed, such as an old revision', () => {
    const older: Partial<PostInput> = { ...emptyPostInput };
    delete older.focusKeyword;
    delete older.relatedTerms;
    const parsed = postInputSchema.parse(older);
    expect(parsed.focusKeyword).toBe('');
    expect(parsed.relatedTerms).toEqual([]);
  });

  it('trims terms and drops repeats regardless of case', () => {
    const parsed = postInputSchema.parse({
      ...emptyPostInput,
      relatedTerms: [' Family ', 'family', 'Ceremony'],
    });
    expect(parsed.relatedTerms).toEqual(['Family', 'Ceremony']);
  });

  it('limits the keyword and the terms', () => {
    const ok = (patch: Partial<PostInput>) =>
      postInputSchema.safeParse({ ...emptyPostInput, ...patch }).success;
    expect(ok({ focusKeyword: 'x'.repeat(80) })).toBe(true);
    expect(ok({ focusKeyword: 'x'.repeat(81) })).toBe(false);
    expect(ok({ relatedTerms: Array.from({ length: 10 }, (_, i) => `term ${i}`) })).toBe(true);
    expect(ok({ relatedTerms: Array.from({ length: 11 }, (_, i) => `term ${i}`) })).toBe(false);
    expect(ok({ relatedTerms: ['x'.repeat(61)] })).toBe(false);
    expect(ok({ relatedTerms: ['   '] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
      Run: `bun run --filter @ll/content test -- posts`
      Expected: FAIL. `focusKeyword` is undefined, and an over-long keyword is accepted.

- [ ] **Step 3: Add the schema fields.** In `packages/content/src/posts.ts`, under `SEO_DESCRIPTION_LIMIT`:

```ts
export const FOCUS_KEYWORD_LIMIT = 80;
export const RELATED_TERM_LIMIT = 60;
export const RELATED_TERMS_MAX = 10;

/** Keeps the first of terms that differ only in case. */
export function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = term.toLocaleLowerCase('en-AU');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

In `postInputSchema`, after `noindex: z.boolean(),`:

```ts
  // For the CMS content score only; the website never renders them. The
  // defaults keep drafts and revisions saved before these existed readable.
  focusKeyword: z.string().trim().max(FOCUS_KEYWORD_LIMIT).default(''),
  relatedTerms: z
    .array(z.string().trim().min(1).max(RELATED_TERM_LIMIT))
    .max(RELATED_TERMS_MAX)
    .transform(uniqueTerms)
    .default([]),
```

In `emptyPostInput`, after `noindex: false,`:

```ts
  focusKeyword: '',
  relatedTerms: [],
```

- [ ] **Step 4: Run the schema tests again.**
      Run: `bun run --filter @ll/content test -- posts`
      Expected: PASS.

- [ ] **Step 5: Add the columns.** In `packages/db/src/schema/content.ts`, in the `posts` table after the `noindex` line:

```ts
    focusKeyword: text('focus_keyword'),
    relatedTerms: text('related_terms', { mode: 'json' }).$type<string[]>().notNull().default([]),
```

Run: `bun run --filter @ll/db generate -- --name post-focus-keyword`
Expected: a new `packages/db/migrations/0021_post_focus_keyword.sql` containing:

```sql
ALTER TABLE `posts` ADD `focus_keyword` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `related_terms` text DEFAULT '[]' NOT NULL;
```

Then run: `bun run --filter @ll/cms db:migrate:local`
Expected: the migration applies with no errors.

- [ ] **Step 6: Write the failing integration test.** Create `apps/cms/src/server/post-store.integration.test.ts`:

```ts
import { emptyPostInput } from '@ll/content';
import { posts } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { createDraft, liveInput, saveEdits } from './post-store';

beforeEach(async () => {
  await testDb().delete(posts);
});

describe('focus keyword and related terms', () => {
  it('are saved with a new post and read back', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const row = await createDraft(
      db,
      {
        ...emptyPostInput,
        title: 'Planting day',
        focusKeyword: 'planting day',
        relatedTerms: ['family', 'ceremony'],
      },
      userId
    );
    const input = await liveInput(db, row);
    expect(input.focusKeyword).toBe('planting day');
    expect(input.relatedTerms).toEqual(['family', 'ceremony']);
  });

  it('wait in the draft of a published post until it is published again', async () => {
    const userId = await addUser('editor');
    const db = testDb();
    const [row] = await db
      .insert(posts)
      .values({ title: 'Live', slug: 'live', status: 'published' })
      .returning();
    await saveEdits(
      db,
      row!,
      { ...(await liveInput(db, row!)), focusKeyword: 'new phrase' },
      userId
    );
    const after = await db.query.posts.findFirst({ where: eq(posts.id, row!.id) });
    expect(after!.focusKeyword).toBeNull();
    expect((after!.draft as { focusKeyword: string }).focusKeyword).toBe('new phrase');
  });

  it('read as empty on a post saved before they existed', async () => {
    const db = testDb();
    const [row] = await db.insert(posts).values({ title: 'Old', slug: 'old' }).returning();
    const input = await liveInput(db, row!);
    expect(input.focusKeyword).toBe('');
    expect(input.relatedTerms).toEqual([]);
  });
});
```

- [ ] **Step 7: Run it and watch it fail.**
      Run: `bun run --filter @ll/cms test:integration -- post-store`
      Expected: FAIL. `liveInput` returns `undefined` for `focusKeyword`.

- [ ] **Step 8: Read and write the columns.** In `apps/cms/src/server/post-store.ts`:

In `liveInput`'s returned object, after `noindex: row.noindex,`:

```ts
    focusKeyword: row.focusKeyword ?? '',
    relatedTerms: row.relatedTerms ?? [],
```

In `columnWrites`'s `columns`, after `noindex: input.noindex,`:

```ts
    focusKeyword: input.focusKeyword || null,
    relatedTerms: input.relatedTerms,
```

- [ ] **Step 9: Let people with only SEO access save them too.** In `apps/cms/src/server/posts.ts`, change `seoSchema`'s pick to:

```ts
  .pick({
    seoTitle: true,
    seoDescription: true,
    noindex: true,
    ogMediaId: true,
    focusKeyword: true,
    relatedTerms: true,
  })
```

In `savePostSeo`, add `focusKeyword: data.focusKeyword || null, relatedTerms: data.relatedTerms,` to the `seo` object, and `focusKeyword: data.focusKeyword, relatedTerms: data.relatedTerms,` to the `draft` spread beside `ogMediaId: data.ogMediaId`.

In `apps/cms/src/components/posts/post-editor/use-post-editor.ts`, `saveSeo`:

```ts
const { seoTitle, seoDescription, noindex, ogMediaId, focusKeyword, relatedTerms } = values;
const result = await savePostSeo({
  data: {
    id: meta.id,
    seoTitle,
    seoDescription,
    noindex,
    ogMediaId,
    focusKeyword,
    relatedTerms,
    expectedUpdatedAt: meta.updatedAt,
  },
});
setSaved((s) => ({
  ...s,
  seoTitle,
  seoDescription,
  noindex,
  ogMediaId,
  focusKeyword,
  relatedTerms,
}));
```

- [ ] **Step 10: Fix the remaining `PostInput` literals.**
      Run: `bun run type-check`
      Expected: errors only where a `PostInput` object literal lacks the two fields (`apps/cms/src/server/api-v1.test.ts`, the `base` literal). Add `focusKeyword: '', relatedTerms: [],` to each one and run again. Expected: no errors.

- [ ] **Step 11: Run the tests.**
      Run: `bun run --filter @ll/content test && bun run --filter @ll/cms test`
      Expected: PASS.

- [ ] **Step 12: Commit.**

```bash
bunx prettier --write packages/content/src/posts.ts packages/content/src/posts.test.ts packages/db/src/schema/content.ts apps/cms/src/server/post-store.ts apps/cms/src/server/post-store.integration.test.ts apps/cms/src/server/posts.ts apps/cms/src/server/api-v1.test.ts apps/cms/src/components/posts/post-editor/use-post-editor.ts
git add packages/content packages/db apps/cms/src/server apps/cms/src/components/posts/post-editor/use-post-editor.ts
git commit -m "feat(cms): store a focus keyword and related terms on posts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content targets in Settings

**Files:**

- Modify: `packages/content/src/settings.ts`
- Modify: `apps/cms/src/server/settings.ts`
- Modify: `apps/cms/src/server/posts.ts` (`getPostEditorData`)
- Modify: `apps/cms/src/components/posts/post-editor/use-post-editor.ts` (returned state)
- Modify: `apps/cms/src/components/settings/settings-page.tsx`
- Test: `packages/content/src/settings.test.ts`

**Interfaces:**

- Produces: `CONTENT_TARGET_KEYS`, `type ContentTargets` (nine numbers: `targetWordsMin`, `targetWordsMax`, `targetHeadingsMin`, `targetHeadingsMax`, `targetParagraphsMin`, `targetImagesMin`, `targetImagesMax`, `targetFocusKeywordUses`, `targetRelatedTermUses`), `contentTargetsFrom(settings: SiteSettings): ContentTargets`, `contentTargetProblem(targets: ContentTargets): string | null`; `PostEditorState.contentTargets: ContentTargets`.

- [ ] **Step 1: Write the failing tests.** Append to `packages/content/src/settings.test.ts`, adding `contentTargetsFrom` and `contentTargetProblem` to its import from `./settings`:

```ts
describe('content targets', () => {
  it('default to the spec ranges when nothing is saved', () => {
    expect(contentTargetsFrom(parseSiteSettings(undefined))).toEqual({
      targetWordsMin: 600,
      targetWordsMax: 2000,
      targetHeadingsMin: 3,
      targetHeadingsMax: 12,
      targetParagraphsMin: 5,
      targetImagesMin: 1,
      targetImagesMax: 8,
      targetFocusKeywordUses: 2,
      targetRelatedTermUses: 1,
    });
  });

  it('keep saved numbers and ignore values of the wrong type', () => {
    const targets = contentTargetsFrom(
      parseSiteSettings({ targetWordsMin: 300, targetWordsMax: '900' })
    );
    expect(targets.targetWordsMin).toBe(300);
    expect(targets.targetWordsMax).toBe(2000);
  });

  it('report a minimum above its maximum', () => {
    const targets = contentTargetsFrom(parseSiteSettings(undefined));
    expect(contentTargetProblem(targets)).toBeNull();
    expect(contentTargetProblem({ ...targets, targetImagesMin: 9 })).toBe(
      'Images: the lowest target is above the highest.'
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
      Run: `bun run --filter @ll/content test -- settings`
      Expected: FAIL with "contentTargetsFrom is not a function".

- [ ] **Step 3: Implement.** In `packages/content/src/settings.ts`, add to `SITE_SETTINGS_DEFAULTS` after `hideFromSearch: false,`:

```ts
  // What the content score measures blog posts against (Settings, Content targets).
  targetWordsMin: 600,
  targetWordsMax: 2000,
  targetHeadingsMin: 3,
  targetHeadingsMax: 12,
  targetParagraphsMin: 5,
  targetImagesMin: 1,
  targetImagesMax: 8,
  targetFocusKeywordUses: 2,
  targetRelatedTermUses: 1,
```

Below `parseSiteSettings`:

```ts
export const CONTENT_TARGET_KEYS = [
  'targetWordsMin',
  'targetWordsMax',
  'targetHeadingsMin',
  'targetHeadingsMax',
  'targetParagraphsMin',
  'targetImagesMin',
  'targetImagesMax',
  'targetFocusKeywordUses',
  'targetRelatedTermUses',
] as const satisfies readonly (keyof SiteSettings)[];

export type ContentTargets = Pick<SiteSettings, (typeof CONTENT_TARGET_KEYS)[number]>;

export function contentTargetsFrom(settings: SiteSettings): ContentTargets {
  return Object.fromEntries(
    CONTENT_TARGET_KEYS.map((key) => [key, settings[key]])
  ) as ContentTargets;
}

const TARGET_RANGES = [
  ['targetWordsMin', 'targetWordsMax', 'Words'],
  ['targetHeadingsMin', 'targetHeadingsMax', 'Headings'],
  ['targetImagesMin', 'targetImagesMax', 'Images'],
] as const;

/** A sentence naming the first range whose minimum is above its maximum. */
export function contentTargetProblem(targets: ContentTargets): string | null {
  for (const [min, max, label] of TARGET_RANGES) {
    if (targets[min] > targets[max]) return `${label}: the lowest target is above the highest.`;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests again.**
      Run: `bun run --filter @ll/content test -- settings`
      Expected: PASS.

- [ ] **Step 5: Validate on the server and let the SEO role save them.** In `apps/cms/src/server/settings.ts`, import `CONTENT_TARGET_KEYS` and `contentTargetProblem` from `@ll/content`. Add above `settingsSchema`:

```ts
const target = z.number().int('Targets are whole numbers.').min(0).max(100_000);
```

Add these keys inside the `z.object({ … })`, after `hideFromSearch`:

```ts
  targetWordsMin: target,
  targetWordsMax: target,
  targetHeadingsMin: target,
  targetHeadingsMax: target,
  targetParagraphsMin: target,
  targetImagesMin: target,
  targetImagesMax: target,
  targetFocusKeywordUses: target,
  targetRelatedTermUses: target,
```

Close the object with a refinement:

```ts
}).superRefine((value, ctx) => {
  const problem = contentTargetProblem(value);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});
```

Extend `SEO_KEYS`:

```ts
const SEO_KEYS = [
  'titlePattern',
  'seoDescription',
  'seoImageUrl',
  'googleVerification',
  'bingVerification',
  'hideFromSearch',
  ...CONTENT_TARGET_KEYS,
] as const satisfies readonly (keyof SiteSettings)[];
```

- [ ] **Step 6: Send the targets to the editor.** In `apps/cms/src/server/posts.ts`, import `contentTargetsFrom` from `@ll/content` and `readSiteSettings` from `@/lib/site-settings`. In `getPostEditorData`, change the `options` line to:

```ts
const options = {
  categories,
  tags: tags.map((t) => t.name),
  authors,
  reviewers,
  contentTargets: contentTargetsFrom(await readSiteSettings()),
};
```

In `use-post-editor.ts`, next to `authors: data.authors,` in the returned state, add `contentTargets: data.contentTargets,`.

- [ ] **Step 7: Add the Settings section.** In `apps/cms/src/components/settings/settings-page.tsx`:

1. Import `CONTENT_TARGET_KEYS`, `contentTargetProblem` and `contentTargetsFrom` from `@ll/content`.
2. Add `{ id: 'content-targets', title: 'Content targets' },` to `sections` after the `search` entry.
3. Change `<SectionNav ids={seoOnly ? ['search'] : …} />` to `seoOnly ? ['search', 'content-targets'] : …`.
4. In `problem()`, before `return null;`:

```ts
const targets = contentTargetProblem(contentTargetsFrom(v));
if (targets) return { field: 'settings-target-words', message: targets };
```

5. After the closing `</SettingsSection>` of `search` (not inside a `!seoOnly` block), add:

```tsx
<SettingsSection
  id="content-targets"
  title="Content targets"
  description="What the content score measures blog posts against."
>
  <SettingsRow id="settings-target-words" title="Words">
    <TargetRange
      id="settings-target-words"
      noun="words"
      min={values.targetWordsMin}
      max={values.targetWordsMax}
      onChange={(min, max) => patch({ targetWordsMin: min, targetWordsMax: max })}
    />
  </SettingsRow>
  <SettingsRow id="settings-target-headings" title="Headings">
    <TargetRange
      id="settings-target-headings"
      noun="headings"
      min={values.targetHeadingsMin}
      max={values.targetHeadingsMax}
      onChange={(min, max) => patch({ targetHeadingsMin: min, targetHeadingsMax: max })}
    />
  </SettingsRow>
  <SettingsRow
    id="settings-target-paragraphs"
    title="Paragraphs"
    description="The fewest a post should have."
  >
    <TargetInput
      id="settings-target-paragraphs"
      label="Fewest paragraphs"
      value={values.targetParagraphsMin}
      onChange={(targetParagraphsMin) => patch({ targetParagraphsMin })}
    />
  </SettingsRow>
  <SettingsRow id="settings-target-images" title="Images">
    <TargetRange
      id="settings-target-images"
      noun="images"
      min={values.targetImagesMin}
      max={values.targetImagesMax}
      onChange={(min, max) => patch({ targetImagesMin: min, targetImagesMax: max })}
    />
  </SettingsRow>
  <SettingsRow
    id="settings-target-keyword"
    title="Focus keyword uses"
    description="The fewest times the focus keyword should appear in the body."
  >
    <TargetInput
      id="settings-target-keyword"
      label="Fewest focus keyword uses"
      value={values.targetFocusKeywordUses}
      onChange={(targetFocusKeywordUses) => patch({ targetFocusKeywordUses })}
    />
  </SettingsRow>
  <SettingsRow
    id="settings-target-terms"
    title="Related term uses"
    description="The fewest times each related term should appear."
  >
    <TargetInput
      id="settings-target-terms"
      label="Fewest related term uses"
      value={values.targetRelatedTermUses}
      onChange={(targetRelatedTermUses) => patch({ targetRelatedTermUses })}
    />
  </SettingsRow>
</SettingsSection>
```

6. Add these helpers beside `Counter`:

```tsx
function TargetInput({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      className="touch:h-11 h-8 w-20 tabular-nums"
    />
  );
}

/** Two numbers, fewest and most, for one target. */
function TargetRange({
  id,
  noun,
  min,
  max,
  onChange,
}: {
  id: string;
  noun: string;
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <TargetInput
        id={id}
        label={`Fewest ${noun}`}
        value={min}
        onChange={(n) => onChange(n, max)}
      />
      <span className="text-muted-foreground text-xs">to</span>
      <TargetInput label={`Most ${noun}`} value={max} onChange={(n) => onChange(min, n)} />
    </div>
  );
}
```

- [ ] **Step 8: Check types and tests.**
      Run: `bun run type-check && bun run --filter @ll/content test && bun run --filter @ll/cms test:unit`
      Expected: PASS.

- [ ] **Step 9: Check it by hand.** Run `bun run dev:cms`, open Settings and go to Content targets. Set images to 9 to 8 and save: an error toast reads "Images: the lowest target is above the highest." Set them back and save: the values stay after a reload. Sign in as an SEO user (or switch role): the section is listed and saves.

- [ ] **Step 10: Commit.**

```bash
bunx prettier --write packages/content/src/settings.ts packages/content/src/settings.test.ts apps/cms/src/server/settings.ts apps/cms/src/server/posts.ts apps/cms/src/components/posts/post-editor/use-post-editor.ts apps/cms/src/components/settings/settings-page.tsx
git add packages/content/src apps/cms/src
git commit -m "feat(cms): content targets in settings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rich-text outline

**Files:**

- Create: `packages/content/src/rich-text-outline.ts`
- Modify: `packages/content/src/index.ts` (add `export * from './rich-text-outline';`)
- Test: `packages/content/src/rich-text-outline.test.ts`

**Interfaces:**

- Produces: `outlineRichText(doc: RichTextDoc | null | undefined): RichTextOutline` where `RichTextOutline = { text: string; words: string[]; paragraphs: string[]; sentences: string[]; headings: { level: number; text: string }[]; imageAlts: string[]; links: { href: string; text: string; internal: boolean }[] }`; `linkKind(href): 'internal' | 'external' | null`; `splitWords(text): string[]`; `splitSentences(text): string[]`; `phraseRegex(phrase): RegExp`; `countPhrase(text, phrase): number`.

- [ ] **Step 1: Write the failing tests.** Create `packages/content/src/rich-text-outline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RichTextDoc } from './posts';
import {
  countPhrase,
  linkKind,
  outlineRichText,
  phraseRegex,
  splitSentences,
} from './rich-text-outline';

const t = (text: string, href?: string) => ({
  type: 'text',
  text,
  ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}),
});
const p = (...content: object[]) => ({ type: 'paragraph', content });
const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [t(text)],
});
const img = (alt?: string) => ({
  type: 'image',
  attrs: { src: '/media/a.jpg', ...(alt === undefined ? {} : { alt }) },
});
const list = (...items: string[]) => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [p(t(item))] })),
});
const table = (text: string) => ({
  type: 'table',
  content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p(t(text))] }] }],
});
const doc = (...content: object[]) => ({ type: 'doc', content }) as RichTextDoc;

describe('outlineRichText', () => {
  it('reads paragraphs, headings, words and sentences', () => {
    const o = outlineRichText(
      doc(
        h(2, 'Why trees'),
        p(t('Trees grow. They live long.')),
        p(t('  ')),
        list('A list item here.')
      )
    );
    expect(o.headings).toEqual([{ level: 2, text: 'Why trees' }]);
    expect(o.paragraphs).toEqual(['Trees grow. They live long.']);
    expect(o.sentences).toEqual(['Trees grow.', 'They live long.', 'A list item here.']);
    expect(o.words).toHaveLength(11);
  });

  it('counts table words but keeps table text out of paragraphs and sentences', () => {
    const o = outlineRichText(doc(table('Price per tree.')));
    expect(o.words).toHaveLength(3);
    expect(o.paragraphs).toEqual([]);
    expect(o.sentences).toEqual([]);
  });

  it('records image alt text, empty when missing or blank, inline images included', () => {
    const o = outlineRichText(doc(img('A young gum'), img(), p(t('See this '), img('  '))));
    expect(o.imageAlts).toEqual(['A young gum', '', '']);
  });

  it('classes links and joins the pieces of one link', () => {
    const o = outlineRichText(
      doc(
        p(
          t('Read '),
          t('our ', '/about'),
          {
            type: 'text',
            text: 'story',
            marks: [{ type: 'bold' }, { type: 'link', attrs: { href: '/about' } }],
          },
          t(' or '),
          t('the news', 'https://example.com/a'),
          t(' and '),
          t('top', '#top'),
          t(' or '),
          t('email', 'mailto:hi@example.com')
        )
      )
    );
    expect(o.links).toEqual([
      { href: '/about', text: 'our story', internal: true },
      { href: 'https://example.com/a', text: 'the news', internal: false },
    ]);
  });

  it('treats a missing or malformed document as empty instead of throwing', () => {
    expect(outlineRichText(null).words).toEqual([]);
    const odd = { type: 'doc', content: 'nope' } as unknown as RichTextDoc;
    expect(outlineRichText(odd).paragraphs).toEqual([]);
    const badHeading = doc({ type: 'heading', attrs: { level: 'x' }, content: [t('Hi')] });
    expect(outlineRichText(badHeading).headings).toEqual([{ level: 2, text: 'Hi' }]);
  });
});

describe('linkKind', () => {
  it('knows site paths and this site, and ignores links that are not pages', () => {
    expect(linkKind('/locations/')).toBe('internal');
    expect(linkKind('https://www.livinglegacy.com.au/faqs/')).toBe('internal');
    expect(linkKind('https://example.com/')).toBe('external');
    expect(linkKind('//example.com/')).toBeNull();
    expect(linkKind('#top')).toBeNull();
    expect(linkKind('tel:0300000000')).toBeNull();
  });
});

describe('splitSentences', () => {
  it('splits after full stops, question marks and exclamation marks', () => {
    expect(splitSentences('Wait. Really? Yes!')).toEqual(['Wait.', 'Really?', 'Yes!']);
  });
});

describe('countPhrase', () => {
  it('matches whole words in any case and any spacing', () => {
    expect(countPhrase('Living trees. living  Trees, livingtrees', 'living trees')).toBe(2);
  });

  it('copes with symbols in the phrase', () => {
    expect(countPhrase('C++ and c++', 'c++')).toBe(2);
    expect(countPhrase('ashes (cremated) here', 'ashes (cremated)')).toBe(1);
    expect(() => phraseRegex('!!!')).not.toThrow();
  });

  it('returns 0 for an empty phrase', () => {
    expect(countPhrase('anything', '  ')).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
      Run: `bun run --filter @ll/content test -- rich-text-outline`
      Expected: FAIL with "Failed to resolve import './rich-text-outline'".

- [ ] **Step 3: Implement.** Create `packages/content/src/rich-text-outline.ts`:

```ts
// What the content score needs from a stored rich text document (Tiptap
// JSON), read in one walk. Unknown or malformed nodes are skipped, never
// thrown on, so the panel always has something to show.
import type { RichTextDoc } from './posts';

export interface OutlineHeading {
  level: number;
  text: string;
}

export interface OutlineLink {
  href: string;
  text: string;
  internal: boolean;
}

export interface RichTextOutline {
  /** All the text, headings, lists and tables included. */
  text: string;
  words: string[];
  /** Paragraphs outside lists and tables, trimmed, empty ones dropped. */
  paragraphs: string[];
  /** Sentences from every paragraph outside tables, lists included. */
  sentences: string[];
  headings: OutlineHeading[];
  /** Alt text of each image, '' when missing. */
  imageAlts: string[];
  /** Links to pages. Anchors, mailto: and tel: are left out. */
  links: OutlineLink[];
}

type Node = { type?: unknown; content?: unknown; marks?: unknown; attrs?: unknown; text?: unknown };

const SITE_HOSTS = new Set(['livinglegacy.com.au', 'www.livinglegacy.com.au']);
const WORD_CHAR = /[\p{L}\p{N}]/u;

const childrenOf = (node: Node): unknown[] => (Array.isArray(node.content) ? node.content : []);
const attrOf = (node: Node, key: string): unknown =>
  node.attrs && typeof node.attrs === 'object'
    ? (node.attrs as Record<string, unknown>)[key]
    : undefined;
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** 'internal' for a site path or this site's host, 'external' for another site, null for anything else. */
export function linkKind(href: string): 'internal' | 'external' | null {
  const value = href.trim();
  if (/^\/(?!\/)/.test(value)) return 'internal';
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return SITE_HOSTS.has(new URL(value).hostname.toLowerCase()) ? 'internal' : 'external';
  } catch {
    return null;
  }
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => WORD_CHAR.test(word));
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => WORD_CHAR.test(sentence));
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches `phrase` as whole words, in any case, with any run of spaces between words. */
export function phraseRegex(phrase: string): RegExp {
  const body = phrase.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

export function countPhrase(text: string, phrase: string): number {
  if (!phrase.trim()) return 0;
  return text.match(phraseRegex(phrase))?.length ?? 0;
}

function linkHref(node: Node): string | null {
  if (!Array.isArray(node.marks)) return null;
  for (const mark of node.marks as { type?: unknown; attrs?: { href?: unknown } }[]) {
    if (mark?.type === 'link' && typeof mark.attrs?.href === 'string') return mark.attrs.href;
  }
  return null;
}

function altOf(node: Node): string {
  const alt = attrOf(node, 'alt');
  return typeof alt === 'string' ? alt.trim() : '';
}

// Like richTextPlainText, but safe on malformed nodes (a non-array `content`
// would make that one throw), and a hard break separates words.
function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Node;
  if (n.type === 'text') return typeof n.text === 'string' ? n.text : '';
  const inner = childrenOf(n).map(plainText).join('');
  return n.type === 'paragraph' || n.type === 'heading' || n.type === 'hardBreak'
    ? `${inner} `
    : inner;
}

export function outlineRichText(doc: RichTextDoc | null | undefined): RichTextOutline {
  const paragraphs: string[] = [];
  const prose: string[] = [];
  const headings: OutlineHeading[] = [];
  const imageAlts: string[] = [];
  const links: OutlineLink[] = [];

  /** Text of an inline run. Records its links; neighbouring pieces of one link join. */
  function inline(node: Node): string {
    let text = '';
    let open: OutlineLink | null = null;
    for (const child of childrenOf(node)) {
      if (!child || typeof child !== 'object') continue;
      const c = child as Node;
      if (c.type === 'text' && typeof c.text === 'string') {
        text += c.text;
        const href = linkHref(c);
        if (href !== null && open && open.href === href) {
          open.text += c.text;
          continue;
        }
        const kind = href === null ? null : linkKind(href);
        open = kind && href ? { href, text: c.text, internal: kind === 'internal' } : null;
        if (open) links.push(open);
        continue;
      }
      open = null;
      if (c.type === 'hardBreak') text += ' ';
      else if (c.type === 'image') imageAlts.push(altOf(c));
      else text += inline(c);
    }
    return text;
  }

  function walk(node: unknown, inList: boolean, inTable: boolean): void {
    if (!node || typeof node !== 'object') return;
    const n = node as Node;
    if (n.type === 'paragraph') {
      const text = squash(inline(n));
      if (!text) return;
      if (!inTable) prose.push(text);
      if (!inList && !inTable) paragraphs.push(text);
      return;
    }
    if (n.type === 'heading') {
      const level = Number(attrOf(n, 'level'));
      headings.push({
        level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2,
        text: squash(inline(n)),
      });
      return;
    }
    if (n.type === 'image') {
      imageAlts.push(altOf(n));
      return;
    }
    const list =
      inList || n.type === 'bulletList' || n.type === 'orderedList' || n.type === 'taskList';
    const table = inTable || n.type === 'table';
    for (const child of childrenOf(n)) walk(child, list, table);
  }

  walk(doc, false, false);
  for (const link of links) link.text = squash(link.text);
  const text = squash(plainText(doc));
  return {
    text,
    words: splitWords(text),
    paragraphs,
    sentences: prose.flatMap(splitSentences),
    headings,
    imageAlts,
    links,
  };
}
```

Add `export * from './rich-text-outline';` to `packages/content/src/index.ts`.

- [ ] **Step 4: Run the tests again.**
      Run: `bun run --filter @ll/content test -- rich-text-outline`
      Expected: PASS. If the "our story" link test fails on the text, check that `inline` appends to `open.text` before `continue`.

- [ ] **Step 5: Commit.**

```bash
bunx prettier --write packages/content/src/rich-text-outline.ts packages/content/src/rich-text-outline.test.ts packages/content/src/index.ts
git add packages/content/src
git commit -m "feat(content): outline rich text for the content score" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Brand language rules

**Files:**

- Create: `packages/content/src/brand-language.ts`
- Modify: `packages/content/src/index.ts` (add `export * from './brand-language';`)
- Test: `packages/content/src/brand-language.test.ts`

**Interfaces:**

- Consumes: `phraseRegex` from Task 3.
- Produces: `BRAND_RULES: readonly BrandRule[]`; `findBrandProblems(text: string): BrandFinding[]` where `BrandFinding = { found: string; count: number; instead: string; severity: 'critical' | 'warning'; kind: 'term' | 'spelling' }`. Critical findings come first.

- [ ] **Step 1: Write the failing tests.** Create `packages/content/src/brand-language.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findBrandProblems } from './brand-language';

describe('findBrandProblems', () => {
  it('reports a never-use word with how it was written and how often', () => {
    expect(findBrandProblems('A grave. Another Grave.')).toEqual([
      {
        found: 'grave',
        count: 2,
        instead: 'Legacy Ground, or their tree',
        severity: 'critical',
        kind: 'term',
      },
    ]);
  });

  it('matches whole words only', () => {
    expect(findBrandProblems('He was gravely ill. A clever plotline.')).toEqual([]);
  });

  it('reports the longest phrase once, not the shorter phrase inside it', () => {
    const found = findBrandProblems('Their final resting place.').map((f) => f.found);
    expect(found).toEqual(['final resting place']);
  });

  it('tells the old treatment name apart from the plain word', () => {
    const findings = findBrandProblems('The Living Legacy Formula, not a formula.');
    expect(findings.map((f) => [f.found, f.severity])).toEqual([
      ['Living Legacy Formula', 'critical'],
      ['formula', 'warning'],
    ]);
  });

  it('treats remains as a warning, since it is also an ordinary verb', () => {
    expect(findBrandProblems('The question remains.')[0]).toMatchObject({
      found: 'remains',
      severity: 'warning',
    });
  });

  it('flags the retired forest name but not the old domain', () => {
    expect(findBrandProblems('Visit Mornington Green.')[0]?.instead).toBe(
      'Living Legacy Mornington'
    );
    expect(findBrandProblems('morningtongreen.com.au')).toEqual([]);
  });

  it('reports each misspelling of EarthSApHE and accepts the right one', () => {
    const findings = findBrandProblems(
      'EARTHSAPHE, Earth SApHE, earthsaphe and EarthSApHE™ Ashes.'
    );
    expect(findings).toEqual([
      {
        found: 'EARTHSAPHE',
        count: 1,
        instead: 'EarthSApHE',
        severity: 'critical',
        kind: 'spelling',
      },
      {
        found: 'Earth SApHE',
        count: 1,
        instead: 'EarthSApHE',
        severity: 'critical',
        kind: 'spelling',
      },
      {
        found: 'earthsaphe',
        count: 1,
        instead: 'EarthSApHE',
        severity: 'critical',
        kind: 'spelling',
      },
    ]);
  });

  it('lists critical findings before warnings', () => {
    const severities = findBrandProblems('A cemetery, a plot.').map((f) => f.severity);
    expect(severities).toEqual(['critical', 'warning']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
      Run: `bun run --filter @ll/content test -- brand-language`
      Expected: FAIL with "Failed to resolve import './brand-language'".

- [ ] **Step 3: Implement.** Create `packages/content/src/brand-language.ts`:

```ts
// Words the brand language guide rules out, for the content score. Source:
// docs/brand-language.md. When the guide changes, update both together.
import { phraseRegex } from './rich-text-outline';

export type BrandSeverity = 'critical' | 'warning';

export interface BrandRule {
  match: string;
  instead: string;
  /** critical: never write it. warning: usually wrong, sometimes fine in context. */
  severity: BrandSeverity;
}

export interface BrandFinding {
  /** The first match, as written. */
  found: string;
  count: number;
  instead: string;
  severity: BrandSeverity;
  kind: 'term' | 'spelling';
}

const GROUND = 'Legacy Ground, or their tree';
const PERSON = "the person's name or relationship, such as your mum";
const TREATMENT = 'EarthSApHE™ Treatment';
const FOREST = 'Living Legacy Forest';
const CEREMONY = 'Legacy Infusion Ceremony';
const CALM = 'state the facts, with no urgency';

export const BRAND_RULES: readonly BrandRule[] = [
  { match: 'plot', instead: GROUND, severity: 'critical' },
  { match: 'plots', instead: GROUND, severity: 'critical' },
  { match: 'grave', instead: GROUND, severity: 'critical' },
  { match: 'graves', instead: GROUND, severity: 'critical' },
  { match: 'final resting place', instead: GROUND, severity: 'critical' },
  { match: 'resting place', instead: GROUND, severity: 'critical' },
  { match: 'cremains', instead: 'ashes', severity: 'critical' },
  { match: 'the deceased', instead: PERSON, severity: 'critical' },
  {
    match: 'paramagnetic',
    instead: 'what the treatment does, in plain words',
    severity: 'critical',
  },
  { match: 'SoilSAFE', instead: TREATMENT, severity: 'critical' },
  { match: 'SSAFE', instead: TREATMENT, severity: 'critical' },
  { match: 'Living Legacy Formula', instead: TREATMENT, severity: 'critical' },
  { match: 'Living Legacy Liquid', instead: TREATMENT, severity: 'critical' },
  { match: 'limited availability', instead: CALM, severity: 'critical' },
  { match: 'act now', instead: CALM, severity: 'critical' },
  { match: 'enquire for pricing', instead: 'show the price', severity: 'critical' },
  { match: 'Mornington Green', instead: 'Living Legacy Mornington', severity: 'critical' },
  { match: 'remains', instead: 'ashes (fine as an ordinary verb)', severity: 'warning' },
  { match: 'cemetery', instead: 'fine only when comparing', severity: 'warning' },
  { match: 'cemeteries', instead: 'fine only when comparing', severity: 'warning' },
  { match: 'formula', instead: TREATMENT, severity: 'warning' },
  { match: 'liquid', instead: TREATMENT, severity: 'warning' },
  { match: 'treated ashes', instead: 'EarthSApHE™ Ashes', severity: 'warning' },
  { match: 'loved one', instead: PERSON, severity: 'warning' },
  { match: 'loved ones', instead: PERSON, severity: 'warning' },
  { match: 'the departed', instead: PERSON, severity: 'warning' },
  { match: 'memorial garden', instead: FOREST, severity: 'warning' },
  { match: 'memorial park', instead: FOREST, severity: 'warning' },
  { match: 'sanctuary', instead: FOREST, severity: 'warning' },
  { match: 'interment', instead: CEREMONY, severity: 'warning' },
  { match: 'burial', instead: CEREMONY, severity: 'warning' },
  { match: 'salesperson', instead: 'Legacy Planner', severity: 'warning' },
  { match: 'officiant', instead: 'celebrant', severity: 'warning' },
];

// Longest first, and each match is blanked out once found, so "final resting
// place" is not reported again as "resting place".
const LONGEST_FIRST = [...BRAND_RULES].sort((a, b) => b.match.length - a.match.length);

export function findBrandProblems(text: string): BrandFinding[] {
  const findings: BrandFinding[] = [];
  let rest = text;
  for (const rule of LONGEST_FIRST) {
    let found = '';
    let count = 0;
    rest = rest.replace(phraseRegex(rule.match), (match) => {
      if (count === 0) found = match;
      count += 1;
      return ' '.repeat(match.length);
    });
    if (count) {
      findings.push({ found, count, instead: rule.instead, severity: rule.severity, kind: 'term' });
    }
  }

  const misspelt = new Map<string, number>();
  for (const [match] of text.matchAll(/earth\s?saphe/gi)) {
    if (match !== 'EarthSApHE') misspelt.set(match, (misspelt.get(match) ?? 0) + 1);
  }
  for (const [found, count] of misspelt) {
    findings.push({ found, count, instead: 'EarthSApHE', severity: 'critical', kind: 'spelling' });
  }

  // Stable sort: rule order within each severity is kept.
  return findings.sort(
    (a, b) => Number(a.severity === 'warning') - Number(b.severity === 'warning')
  );
}
```

Add `export * from './brand-language';` to `packages/content/src/index.ts`.

- [ ] **Step 4: Run the tests again.**
      Run: `bun run --filter @ll/content test -- brand-language`
      Expected: PASS. The "Living Legacy Formula" test depends on longest-first order: "Living Legacy Formula" (21 characters) runs before "formula" (7).

- [ ] **Step 5: Commit.**

```bash
bunx prettier --write packages/content/src/brand-language.ts packages/content/src/brand-language.test.ts packages/content/src/index.ts
git add packages/content/src
git commit -m "feat(content): brand language rules for the content score" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The analysis engine and score

**Files:**

- Create: `packages/content/src/content-score.ts`
- Modify: `packages/content/src/index.ts` (add `export * from './content-score';`)
- Test: `packages/content/src/content-score.test.ts`

**Interfaces:**

- Consumes: `PostInput` and `slugify` (Task 1, `posts.ts`); `ContentTargets` (Task 2); `outlineRichText`, `countPhrase` and `splitWords` (Task 3); `findBrandProblems` and `BrandFinding` (Task 4).
- Produces: types `Range`, `TermTarget`, `ContentGuidelines`, `ScoreInput`, `CheckStatus`, `ScoreCategory`, `ScoreCheck`, `RangeState`, `StructureCount`, `TermState`, `TermUse`, `ContentScore`; constant `SCORE_CATEGORIES`; functions `rangeState`, `formatRange`, `scoreBand`, `guidelinesFromSettings(targets, input)`, `scoreChecks(checks)`, `analysePost(input, guidelines)`.

- [ ] **Step 1: Write the failing tests.** Create `packages/content/src/content-score.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  type ContentGuidelines,
  type ContentScore,
  type ScoreCheck,
  type ScoreInput,
  analysePost,
  formatRange,
  guidelinesFromSettings,
  scoreBand,
  scoreChecks,
} from './content-score';
import type { RichTextDoc } from './posts';
import { SITE_SETTINGS_DEFAULTS, contentTargetsFrom } from './settings';

const t = (text: string, href?: string) => ({
  type: 'text',
  text,
  ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}),
});
const p = (...content: object[]) => ({ type: 'paragraph', content });
const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [t(text)],
});
const img = (alt?: string) => ({
  type: 'image',
  attrs: { src: '/media/a.jpg', ...(alt === undefined ? {} : { alt }) },
});
const doc = (...content: object[]) => ({ type: 'doc', content }) as RichTextDoc;

const loose: ContentGuidelines = {
  source: 'settings',
  words: { min: 1, max: null },
  headings: { min: 1, max: null },
  paragraphs: { min: 1, max: null },
  images: { min: 1, max: null },
  terms: [
    { term: 'Legacy Infusion Ceremony', min: 2, kind: 'focus' },
    { term: 'family', min: 1, kind: 'related' },
  ],
};

const good: ScoreInput = {
  title: 'What happens at a Legacy Infusion Ceremony',
  seoTitle: '',
  seoDescription:
    'A Legacy Infusion Ceremony is where family and friends gather to place the ashes and see the tree take them up.',
  excerpt: '',
  slug: 'legacy-infusion-ceremony-guide',
  body: doc(
    h(2, 'Before the Legacy Infusion Ceremony'),
    p(
      t('The Legacy Infusion Ceremony brings family together. It is calm and unhurried. See '),
      t('our forests', '/locations/'),
      t('.')
    ),
    h(3, 'On the day'),
    p(t('Everyone gathers by the tree. The Legacy Infusion Ceremony takes about an hour.')),
    img('Family gathered around a young tree')
  ),
  featuredMediaId: 'media-1',
  noindex: false,
  focusKeyword: 'Legacy Infusion Ceremony',
  relatedTerms: ['family'],
};

const statusOf = (result: ContentScore, id: string) =>
  result.checks.find((c) => c.id === id)?.status;
const check = (category: ScoreCheck['category'], status: ScoreCheck['status']): ScoreCheck => ({
  id: `${category}-${status}`,
  category,
  status,
  message: '',
  why: '',
});

describe('analysePost', () => {
  it('passes a well-made post on keyword placement, structure, links, images and brand', () => {
    const result = analysePost(good, loose);
    for (const id of [
      'focus-keyword',
      'title-length',
      'description',
      'keyword-in-title',
      'keyword-in-description',
      'keyword-in-slug',
      'keyword-in-first-paragraph',
      'keyword-in-subheading',
      'keyword-uses',
      'related-terms',
      'heading-order',
      'no-h1',
      'featured-image',
      'alt-text',
      'internal-link',
      'link-text',
      'brand-never',
      'brand-avoid',
      'brand-spelling',
      'punctuation',
    ]) {
      expect([id, statusOf(result, id)]).toEqual([id, 'pass']);
    }
    // 3 uses in 36 words is far over 3%, which a real post would not be.
    expect(statusOf(result, 'keyword-stuffing')).toBe('warning');
  });

  it('skips the keyword checks until there is a focus keyword', () => {
    const result = analysePost({ ...good, focusKeyword: '' }, { ...loose, terms: [] });
    expect(statusOf(result, 'focus-keyword')).toBe('critical');
    expect(statusOf(result, 'keyword-in-title')).toBe('skipped');
    expect(statusOf(result, 'keyword-uses')).toBe('skipped');
    expect(statusOf(result, 'keyword-stuffing')).toBe('skipped');
  });

  it('does not pass the slug check for a keyword with no letters', () => {
    const result = analysePost({ ...good, focusKeyword: '!!!' }, loose);
    expect(statusOf(result, 'keyword-in-slug')).toBe('warning');
  });

  it('matches the keyword to whole slug segments', () => {
    const withSlug = (slug: string) =>
      statusOf(analysePost({ ...good, focusKeyword: 'tree', slug }, loose), 'keyword-in-slug');
    expect(withSlug('a-tree-for-mum')).toBe('pass');
    expect(withSlug('trees-for-mum')).toBe('warning');
  });

  it('falls back to the excerpt for the description, and is critical with neither', () => {
    expect(
      statusOf(
        analysePost({ ...good, seoDescription: '', excerpt: 'Too short.' }, loose),
        'description'
      )
    ).toBe('warning');
    expect(
      statusOf(analysePost({ ...good, seoDescription: '', excerpt: '' }, loose), 'description')
    ).toBe('critical');
  });

  it('flags missing alt text, skipped heading levels, an H1 and vague link text', () => {
    const result = analysePost(
      {
        ...good,
        body: doc(h(1, 'Title again'), h(2, 'A'), h(4, 'B'), p(t('click here', '/faqs/')), img()),
      },
      loose
    );
    expect(statusOf(result, 'alt-text')).toBe('critical');
    expect(result.checks.find((c) => c.id === 'alt-text')?.message).toBe(
      '1 image without alt text.'
    );
    expect(statusOf(result, 'heading-order')).toBe('warning');
    expect(statusOf(result, 'no-h1')).toBe('warning');
    expect(statusOf(result, 'link-text')).toBe('warning');
  });

  it('reports brand problems and house punctuation', () => {
    const result = analysePost(
      { ...good, body: doc(p(t('Visit the grave. EARTHSAPHE is great!'))) },
      loose
    );
    expect(statusOf(result, 'brand-never')).toBe('critical');
    expect(statusOf(result, 'brand-spelling')).toBe('critical');
    expect(statusOf(result, 'punctuation')).toBe('warning');
    expect(result.brand.map((f) => f.found)).toEqual(['grave', 'EARTHSAPHE']);
  });

  it('reads brand problems in image alt text too', () => {
    const result = analysePost({ ...good, body: doc(img('A cemetery plot')) }, loose);
    expect(result.brand.map((f) => f.found)).toContain('plot');
  });

  it('gives each structure count and term a state', () => {
    const result = analysePost(good, {
      ...loose,
      words: { min: 100, max: 200 },
      terms: [...loose.terms, { term: 'celebrant', min: 1, kind: 'related' }],
    });
    expect(result.structure.find((s) => s.key === 'words')).toMatchObject({
      value: 36,
      state: 'below',
    });
    expect(result.terms.find((term) => term.term === 'celebrant')).toMatchObject({
      count: 0,
      state: 'unused',
    });
    expect(result.terms.find((term) => term.kind === 'focus')).toMatchObject({
      count: 3,
      state: 'met',
    });
    expect(statusOf(result, 'related-terms')).toBe('warning');
  });

  it('scores an empty new post without NaN and skips the body checks', () => {
    const result = analysePost(
      {
        ...good,
        title: '',
        slug: '',
        body: null,
        focusKeyword: '',
        relatedTerms: [],
        featuredMediaId: null,
      },
      { ...loose, terms: [] }
    );
    expect(Number.isInteger(result.score)).toBe(true);
    expect(statusOf(result, 'sentence-length')).toBe('skipped');
    expect(statusOf(result, 'alt-text')).toBe('skipped');
  });

  it('warns when the post is hidden from search engines', () => {
    expect(statusOf(analysePost({ ...good, noindex: true }, loose), 'indexing')).toBe('warning');
  });
});

describe('scoreChecks', () => {
  it('scores 100 when everything passes', () => {
    expect(scoreChecks([check('basic', 'pass'), check('brand', 'pass')]).score).toBe(100);
  });

  it('weights categories, counts a warning as half and a critical issue as nothing', () => {
    const basicHalf = scoreChecks([check('basic', 'pass'), check('basic', 'critical')]);
    expect(basicHalf.categories.basic).toBe(50);
    expect(basicHalf.score).toBe(88); // 100 - 25 x 0.5 = 87.5
    expect(scoreChecks([check('technical', 'warning')]).score).toBe(95); // 100 - 10 x 0.5
  });

  it('leaves skipped checks out, and a category with none left scores 100', () => {
    const result = scoreChecks([check('links', 'skipped'), check('images', 'critical')]);
    expect(result.categories.links).toBe(100);
    expect(result.score).toBe(85);
  });
});

describe('guidelinesFromSettings', () => {
  const targets = contentTargetsFrom(SITE_SETTINGS_DEFAULTS);

  it('maps the targets and adds the post terms', () => {
    const g = guidelinesFromSettings(targets, { focusKeyword: ' Tree ', relatedTerms: ['family'] });
    expect(g.source).toBe('settings');
    expect(g.words).toEqual({ min: 600, max: 2000 });
    expect(g.paragraphs).toEqual({ min: 5, max: null });
    expect(g.terms).toEqual([
      { term: 'Tree', min: 2, kind: 'focus' },
      { term: 'family', min: 1, kind: 'related' },
    ]);
  });

  it('drops related terms that repeat the keyword or each other', () => {
    const g = guidelinesFromSettings(targets, {
      focusKeyword: 'tree',
      relatedTerms: ['Tree', 'family', 'FAMILY', ' '],
    });
    expect(g.terms.map((term) => term.term)).toEqual(['tree', 'family']);
  });
});

describe('formatRange and scoreBand', () => {
  it('format ranges and name score bands', () => {
    expect(formatRange({ min: 600, max: 2000 })).toBe('600 to 2,000');
    expect(formatRange({ min: 5, max: null })).toBe('at least 5');
    expect(scoreBand(49).label).toBe('Needs work');
    expect(scoreBand(50).label).toBe('Good');
    expect(scoreBand(80).label).toBe('Strong');
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
      Run: `bun run --filter @ll/content test -- content-score`
      Expected: FAIL with "Failed to resolve import './content-score'".

- [ ] **Step 3: Implement.** Create `packages/content/src/content-score.ts`:

```ts
// The content score: editorial checks on a blog post, grouped and weighted
// into a score out of 100. Advice only. It does not predict search rankings
// and never blocks saving or publishing. Pure, so the editor and the server
// can both run it.
import { type BrandFinding, findBrandProblems } from './brand-language';
import { type PostInput, slugify } from './posts';
import { countPhrase, outlineRichText, splitWords } from './rich-text-outline';
import type { ContentTargets } from './settings';

export type Range = { min: number; max: number | null };
export type TermTarget = { term: string; min: number; kind: 'focus' | 'related' };

/** What a post is measured against. Settings fill it today; top-ranking pages could later. */
export interface ContentGuidelines {
  source: 'settings' | 'competitors';
  words: Range;
  headings: Range;
  paragraphs: Range;
  images: Range;
  terms: TermTarget[];
}

export type ScoreInput = Pick<
  PostInput,
  | 'title'
  | 'seoTitle'
  | 'seoDescription'
  | 'excerpt'
  | 'slug'
  | 'body'
  | 'featuredMediaId'
  | 'noindex'
  | 'focusKeyword'
  | 'relatedTerms'
>;

export type CheckStatus = 'pass' | 'warning' | 'critical' | 'skipped';
export type ScoreCategory = 'basic' | 'content' | 'technical' | 'images' | 'links' | 'brand';

export interface ScoreCheck {
  id: string;
  category: ScoreCategory;
  status: CheckStatus;
  message: string;
  why: string;
}

export type RangeState = 'below' | 'within' | 'above';

export interface StructureCount {
  key: 'words' | 'headings' | 'paragraphs' | 'images';
  label: string;
  value: number;
  target: Range;
  state: RangeState;
}

export type TermState = 'met' | 'partial' | 'unused';

export interface TermUse {
  term: string;
  kind: 'focus' | 'related';
  count: number;
  min: number;
  state: TermState;
}

export interface ContentScore {
  score: number;
  categories: Record<ScoreCategory, number>;
  checks: ScoreCheck[];
  structure: StructureCount[];
  terms: TermUse[];
  brand: BrandFinding[];
  source: ContentGuidelines['source'];
}

/** Weights total 100. */
export const SCORE_CATEGORIES: readonly { id: ScoreCategory; label: string; weight: number }[] = [
  { id: 'basic', label: 'Basic SEO', weight: 25 },
  { id: 'content', label: 'Content quality', weight: 25 },
  { id: 'technical', label: 'Technical', weight: 10 },
  { id: 'images', label: 'Images', weight: 15 },
  { id: 'links', label: 'Links', weight: 10 },
  { id: 'brand', label: 'Brand language', weight: 15 },
];

const STATUS_VALUE = { pass: 1, warning: 0.5, critical: 0 } as const;
const VAGUE_LINK_TEXT = /^(click here|here|read more|more|this link|link)$/i;
const BARE_URL = /^(https?:\/\/|www\.)/i;
const STUFFING_SHARE = 0.03;

const n = (value: number) => value.toLocaleString('en-AU');
const plural = (count: number, word: string, many = `${word}s`) =>
  `${n(count)} ${count === 1 ? word : many}`;

export function rangeState(value: number, range: Range): RangeState {
  if (value < range.min) return 'below';
  if (range.max !== null && value > range.max) return 'above';
  return 'within';
}

export function formatRange(range: Range): string {
  return range.max === null ? `at least ${n(range.min)}` : `${n(range.min)} to ${n(range.max)}`;
}

export function scoreBand(score: number): { band: 'low' | 'mid' | 'high'; label: string } {
  if (score >= 80) return { band: 'high', label: 'Strong' };
  if (score >= 50) return { band: 'mid', label: 'Good' };
  return { band: 'low', label: 'Needs work' };
}

/** Targets from Settings, with the post's own focus keyword and related terms. */
export function guidelinesFromSettings(
  targets: ContentTargets,
  input: Pick<ScoreInput, 'focusKeyword' | 'relatedTerms'>
): ContentGuidelines {
  const focus = input.focusKeyword.trim();
  const seen = new Set(focus ? [focus.toLowerCase()] : []);
  const related = input.relatedTerms
    .map((term) => term.trim())
    .filter((term) => {
      const key = term.toLowerCase();
      if (!term || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    source: 'settings',
    words: { min: targets.targetWordsMin, max: targets.targetWordsMax },
    headings: { min: targets.targetHeadingsMin, max: targets.targetHeadingsMax },
    paragraphs: { min: targets.targetParagraphsMin, max: null },
    images: { min: targets.targetImagesMin, max: targets.targetImagesMax },
    terms: [
      ...(focus
        ? [{ term: focus, min: targets.targetFocusKeywordUses, kind: 'focus' as const }]
        : []),
      ...related.map((term) => ({
        term,
        min: targets.targetRelatedTermUses,
        kind: 'related' as const,
      })),
    ],
  };
}

/** Category scores and the weighted total. Skipped checks do not count. */
export function scoreChecks(checks: ScoreCheck[]): Pick<ContentScore, 'score' | 'categories'> {
  const categories = {} as Record<ScoreCategory, number>;
  let total = 0;
  for (const { id, weight } of SCORE_CATEGORIES) {
    const scored = checks.filter((c) => c.category === id && c.status !== 'skipped');
    const value = scored.length
      ? scored.reduce((sum, c) => sum + STATUS_VALUE[c.status as keyof typeof STATUS_VALUE], 0) /
        scored.length
      : 1;
    categories[id] = Math.round(value * 100);
    total += value * weight;
  }
  return { score: Math.round(total), categories };
}

export function analysePost(input: ScoreInput, guidelines: ContentGuidelines): ContentScore {
  const outline = outlineRichText(input.body);
  const checks: ScoreCheck[] = [];
  const add = (
    category: ScoreCategory,
    id: string,
    status: CheckStatus,
    message: string,
    why: string
  ) => checks.push({ id, category, status, message, why });
  const passIf = (ok: boolean, otherwise: 'warning' | 'critical' = 'warning'): CheckStatus =>
    ok ? 'pass' : otherwise;

  const title = input.seoTitle.trim() || input.title.trim();
  const description = input.seoDescription.trim() || input.excerpt.trim();
  const keyword = input.focusKeyword.trim();
  const hasKeyword = (text: string) => countPhrase(text, keyword) > 0;
  const keywordCheck = (id: string, place: string, found: () => boolean, why: string) => {
    if (!keyword) return add('basic', id, 'skipped', `Add a focus keyword to check ${place}.`, why);
    const ok = found();
    add('basic', id, passIf(ok), `The focus keyword ${ok ? 'is' : 'is not'} in ${place}.`, why);
  };

  // Basic SEO
  add(
    'basic',
    'focus-keyword',
    passIf(!!keyword, 'critical'),
    keyword ? `Focus keyword: "${keyword}".` : 'No focus keyword yet. Add one in Search listing.',
    'The keyword checks measure the post against the phrase people search for.'
  );
  add(
    'basic',
    'title-length',
    passIf(title.length >= 30 && title.length <= 60),
    `The search title is ${plural(title.length, 'character')} (aim for 30 to 60).`,
    'Search results cut off long titles, and short ones waste the space.'
  );
  add(
    'basic',
    'description',
    description ? passIf(description.length >= 70 && description.length <= 160) : 'critical',
    description
      ? `The search description is ${plural(description.length, 'character')} (aim for 70 to 160).`
      : 'No search description or summary.',
    'Without one, search engines pick a snippet from the page, which is often a poor fit.'
  );
  keywordCheck(
    'keyword-in-title',
    'the search title',
    () => hasKeyword(title),
    'People scan results for the words they searched.'
  );
  keywordCheck(
    'keyword-in-description',
    'the search description',
    () => hasKeyword(description),
    'Search engines bold matching words in the snippet.'
  );
  keywordCheck(
    'keyword-in-slug',
    'the permalink',
    () => {
      const segment = slugify(keyword);
      return segment !== '' && `-${input.slug}-`.includes(`-${segment}-`);
    },
    'A readable address tells people what the page is before they open it.'
  );
  keywordCheck(
    'keyword-in-first-paragraph',
    'the first paragraph',
    () => hasKeyword(outline.paragraphs[0] ?? ''),
    'It confirms early that the post answers what the reader searched for.'
  );
  keywordCheck(
    'keyword-in-subheading',
    'an H2 or H3',
    () => outline.headings.some((h) => (h.level === 2 || h.level === 3) && hasKeyword(h.text)),
    'Subheadings show the shape of the topic to readers and search engines.'
  );

  // Structure, used by Content quality and Images
  const counts = {
    words: outline.words.length,
    headings: outline.headings.length,
    paragraphs: outline.paragraphs.length,
    images: outline.imageAlts.length,
  };
  const labels = {
    words: 'Words',
    headings: 'Headings',
    paragraphs: 'Paragraphs',
    images: 'Images',
  } as const;
  const structure: StructureCount[] = (['words', 'headings', 'paragraphs', 'images'] as const).map(
    (key) => ({
      key,
      label: labels[key],
      value: counts[key],
      target: guidelines[key],
      state: rangeState(counts[key], guidelines[key]),
    })
  );
  const rangeCheck = (category: ScoreCategory, key: StructureCount['key'], why: string) => {
    const s = structure.find((x) => x.key === key)!;
    add(
      category,
      `${key}-count`,
      passIf(s.state === 'within'),
      `${n(s.value)} ${s.label.toLowerCase()} (target ${formatRange(s.target)}).`,
      why
    );
  };

  // Content quality
  rangeCheck('content', 'words', 'Enough depth to answer the question, without padding.');
  rangeCheck('content', 'headings', 'Subheadings let readers scan and jump to what they need.');
  rangeCheck('content', 'paragraphs', 'Short paragraphs are easier to read on a phone.');

  const terms: TermUse[] = guidelines.terms.map(({ term, kind, min }) => {
    const count = countPhrase(outline.text, term);
    return {
      term,
      kind,
      min,
      count,
      state: count >= min ? 'met' : count > 0 ? 'partial' : 'unused',
    };
  });
  const focus = terms.find((term) => term.kind === 'focus');
  add(
    'content',
    'keyword-uses',
    focus ? passIf(focus.state === 'met') : 'skipped',
    focus
      ? `The focus keyword appears ${plural(focus.count, 'time')} in the body (aim for at least ${n(focus.min)}).`
      : 'Add a focus keyword to count its uses.',
    'Using the phrase naturally tells readers and search engines what the post covers.'
  );
  const share =
    focus && counts.words ? (focus.count * splitWords(keyword).length) / counts.words : 0;
  add(
    'content',
    'keyword-stuffing',
    focus && counts.words ? passIf(share < STUFFING_SHARE) : 'skipped',
    share >= STUFFING_SHARE
      ? 'The focus keyword makes up over 3% of the words. Try other ways of saying it.'
      : 'The focus keyword is not overused.',
    'Repeating a phrase too often reads badly and can look like spam to search engines.'
  );
  const related = terms.filter((term) => term.kind === 'related');
  const short = related.filter((term) => term.state !== 'met');
  add(
    'content',
    'related-terms',
    related.length ? passIf(short.length === 0) : 'skipped',
    !related.length
      ? 'No related terms added.'
      : short.length
        ? `Not used enough yet: ${short.map((term) => term.term).join(', ')}.`
        : 'Every related term is used.',
    'Related terms help the post cover the whole topic.'
  );

  const sentenceWords = outline.sentences.map((sentence) => splitWords(sentence).length);
  const average = sentenceWords.length
    ? sentenceWords.reduce((a, b) => a + b, 0) / sentenceWords.length
    : 0;
  const longShare = sentenceWords.length
    ? sentenceWords.filter((w) => w > 25).length / sentenceWords.length
    : 0;
  add(
    'content',
    'sentence-length',
    sentenceWords.length ? passIf(average <= 20) : 'skipped',
    `Sentences average ${plural(Math.round(average), 'word')} (aim for 20 or fewer).`,
    'Shorter sentences are easier to follow, especially for readers going through a hard time.'
  );
  add(
    'content',
    'long-sentences',
    sentenceWords.length ? passIf(longShare <= 0.25) : 'skipped',
    `${Math.round(longShare * 100)}% of sentences are over 25 words (aim for 25% or fewer).`,
    'Long sentences are where readers lose the thread.'
  );
  const longParagraphs = outline.paragraphs.filter((para) => splitWords(para).length > 150).length;
  add(
    'content',
    'long-paragraphs',
    outline.paragraphs.length ? passIf(longParagraphs === 0) : 'skipped',
    longParagraphs
      ? `${plural(longParagraphs, 'paragraph')} over 150 words.`
      : 'No paragraph is over 150 words.',
    'Long blocks of text are hard to read on a phone.'
  );

  // Technical
  const levels = outline.headings.map((h) => h.level);
  const inOrder = levels.every((level, i) => (i === 0 ? level <= 2 : level <= levels[i - 1]! + 1));
  add(
    'technical',
    'heading-order',
    levels.length ? passIf(inOrder) : 'skipped',
    inOrder
      ? 'Headings go in order.'
      : 'A heading skips a level, such as an H4 straight after an H2.',
    'Screen readers and search engines use heading levels to understand the outline.'
  );
  const h1s = levels.filter((level) => level === 1).length;
  add(
    'technical',
    'no-h1',
    passIf(h1s === 0),
    h1s
      ? `${plural(h1s, 'H1')} in the body. The post title is already the H1.`
      : 'No H1 in the body.',
    'One H1 per page keeps the main topic clear.'
  );
  add(
    'technical',
    'slug-length',
    input.slug ? passIf(input.slug.length <= 60) : 'warning',
    input.slug
      ? `The permalink is ${plural(input.slug.length, 'character')} (aim for 60 or fewer).`
      : 'No permalink yet.',
    'Short addresses are easier to share and to read in results.'
  );
  add(
    'technical',
    'indexing',
    passIf(!input.noindex),
    input.noindex
      ? 'This post will not appear in search. Hide from search engines is on.'
      : 'Search engines may list this post.',
    'A hidden post gets no search traffic.'
  );

  // Images
  add(
    'images',
    'featured-image',
    passIf(!!input.featuredMediaId, 'critical'),
    input.featuredMediaId ? 'Featured image set.' : 'No featured image.',
    'It shows on blog cards and when the post is shared.'
  );
  rangeCheck('images', 'images', 'Images break up the text and show what words cannot.');
  const missingAlt = outline.imageAlts.filter((alt) => !alt).length;
  add(
    'images',
    'alt-text',
    outline.imageAlts.length ? passIf(missingAlt === 0, 'critical') : 'skipped',
    missingAlt ? `${plural(missingAlt, 'image')} without alt text.` : 'Every image has alt text.',
    'Alt text describes the image to people using screen readers, and to search engines.'
  );

  // Links
  const internal = outline.links.filter((link) => link.internal).length;
  add(
    'links',
    'internal-link',
    passIf(internal > 0),
    internal
      ? `${plural(internal, 'link')} to other pages on the site.`
      : 'No links to other pages on the site.',
    'Internal links help readers, and search engines, find related pages.'
  );
  const vague = outline.links.filter(
    (link) => VAGUE_LINK_TEXT.test(link.text) || BARE_URL.test(link.text)
  ).length;
  add(
    'links',
    'link-text',
    outline.links.length ? passIf(vague === 0) : 'skipped',
    vague
      ? `${plural(vague, 'link')} with text such as "click here" or a bare web address.`
      : 'Link text says where each link goes.',
    'Screen reader users often jump from link to link, so the text has to make sense on its own.'
  );

  // Brand language
  const brandText = [
    input.title,
    input.seoTitle,
    input.seoDescription,
    input.excerpt,
    outline.text,
    ...outline.imageAlts,
  ].join('\n');
  const brand = findBrandProblems(brandText);
  const never = brand.filter((f) => f.kind === 'term' && f.severity === 'critical');
  const avoid = brand.filter((f) => f.kind === 'term' && f.severity === 'warning');
  const spelling = brand.filter((f) => f.kind === 'spelling');
  const found = (list: BrandFinding[]) => list.map((f) => f.found).join(', ');
  add(
    'brand',
    'brand-never',
    passIf(!never.length, 'critical'),
    never.length ? `Words the brand never uses: ${found(never)}.` : 'None of the never-use words.',
    'The brand language guide rules these out for every customer-facing word.'
  );
  add(
    'brand',
    'brand-avoid',
    passIf(!avoid.length),
    avoid.length ? `Words to check: ${found(avoid)}.` : 'None of the words to avoid.',
    'These are usually wrong for the brand, though some are fine in context.'
  );
  add(
    'brand',
    'brand-spelling',
    passIf(!spelling.length, 'critical'),
    spelling.length
      ? `EarthSApHE written as ${found(spelling)}.`
      : 'EarthSApHE is written correctly wherever it appears.',
    'The name is a trade mark and is always written exactly EarthSApHE.'
  );
  const dashes = brandText.match(/[–—]/g)?.length ?? 0;
  const bangs = brandText.match(/!/g)?.length ?? 0;
  add(
    'brand',
    'punctuation',
    passIf(!dashes && !bangs),
    dashes || bangs
      ? `${plural(dashes, 'dash', 'dashes')} and ${plural(bangs, 'exclamation mark')}.`
      : 'No em or en dashes and no exclamation marks.',
    'House style uses neither in information copy.'
  );

  return { ...scoreChecks(checks), checks, structure, terms, brand, source: guidelines.source };
}
```

Add `export * from './content-score';` to `packages/content/src/index.ts`.

- [ ] **Step 4: Run the tests again.**
      Run: `bun run --filter @ll/content test -- content-score`
      Expected: PASS. If `title-length` fails, the title is 42 characters and should pass; check the effective title uses `input.title` when `seoTitle` is empty. If the word count test fails, recount: the headings and paragraphs in `good` hold 5 + 15 + 3 + 13 = 36 words.

- [ ] **Step 5: Run the whole package and type-check.**
      Run: `bun run --filter @ll/content test && bun run --filter @ll/content type-check`
      Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
bunx prettier --write packages/content/src/content-score.ts packages/content/src/content-score.test.ts packages/content/src/index.ts
git add packages/content/src
git commit -m "feat(content): content score analysis engine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Focus keyword and related terms fields in the editor

**Files:**

- Create: `apps/cms/src/components/posts/post-editor/terms-input.tsx`
- Modify: `apps/cms/src/components/posts/post-editor/seo-fields.tsx`

**Interfaces:**

- Consumes: `PostInput.focusKeyword`, `PostInput.relatedTerms`, `FOCUS_KEYWORD_LIMIT`, `RELATED_TERM_LIMIT`, `RELATED_TERMS_MAX` (Task 1).
- Produces: `TermsInput({ id, terms, max, maxLength, placeholder, onChange })`.

- [ ] **Step 1: Create the chip input.** `apps/cms/src/components/posts/post-editor/terms-input.tsx`:

```tsx
import { useState } from 'react';
import { XIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';

/** Short phrases as removable chips. Type one, then press Enter or a comma. */
export function TermsInput({
  id,
  terms,
  max,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  terms: string[];
  max: number;
  maxLength: number;
  placeholder: string;
  onChange: (terms: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const full = terms.length >= max;

  function add() {
    const term = draft.trim();
    setDraft('');
    if (!term || full) return;
    if (terms.some((t) => t.toLowerCase() === term.toLowerCase())) return;
    onChange([...terms, term]);
  }

  return (
    <div className="space-y-1.5">
      {terms.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {terms.map((term) => (
            <li
              key={term}
              className="bg-muted flex items-center gap-0.5 rounded-md py-0.5 pr-0.5 pl-2 text-xs"
            >
              {term}
              <button
                type="button"
                aria-label={`Remove ${term}`}
                onClick={() => onChange(terms.filter((t) => t !== term))}
                className="text-muted-foreground hover:text-foreground touch:size-8 grid size-5 place-items-center rounded"
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        maxLength={maxLength}
        disabled={full}
        placeholder={full ? `Up to ${max} terms` : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && terms.length) {
            onChange(terms.slice(0, -1));
          }
        }}
        onBlur={add}
        className="text-ui touch:h-11 h-8"
      />
    </div>
  );
}
```

- [ ] **Step 2: Add the fields.** In `seo-fields.tsx`, extend the `@ll/content` import with `FOCUS_KEYWORD_LIMIT`, `RELATED_TERMS_MAX` and `RELATED_TERM_LIMIT`, and import `{ TermsInput } from './terms-input'`. After the Description `CountedField`, add:

```tsx
      <div className="space-y-1">
        <CountedField
          id="seo-focus-keyword"
          label="Focus keyword"
          value={values.focusKeyword}
          limit={FOCUS_KEYWORD_LIMIT}
          placeholder="The phrase people search for"
          onChange={(focusKeyword) => onChange({ focusKeyword })}
        />
        <p className="text-muted-foreground text-xs">Used only for the content score.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="seo-related-terms" className="text-muted-foreground text-xs font-normal">
          Related terms
        </Label>
        <TermsInput
          id="seo-related-terms"
          terms={values.relatedTerms}
          max={RELATED_TERMS_MAX}
          maxLength={RELATED_TERM_LIMIT}
          placeholder="Type a term, then press Enter"
          onChange={(relatedTerms) => onChange({ relatedTerms })}
        />
      </div>
```

- [ ] **Step 3: Check types and lint.**
      Run: `bun run type-check && bun run lint`
      Expected: no errors.

- [ ] **Step 4: Check it by hand.** Run `bun run dev:cms` and open a post. In Search listing, type a focus keyword, then add three related terms with Enter and one with a comma. Remove one with ×, and one with Backspace in the empty input. Save, reload, and see they are kept. Open a published post as an SEO user, change the keyword and save the search listing: it is kept after a reload. On a 390px touch-emulated screen, the × targets are easy to tap.

- [ ] **Step 5: Commit.**

```bash
bunx prettier --write apps/cms/src/components/posts/post-editor/terms-input.tsx apps/cms/src/components/posts/post-editor/seo-fields.tsx
git add apps/cms/src/components/posts/post-editor
git commit -m "feat(cms): focus keyword and related terms fields" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The content score panel

**Files:**

- Create: `apps/cms/src/components/posts/post-editor/content-score/use-content-score.ts`
- Create: `apps/cms/src/components/posts/post-editor/content-score/score-tone.ts`
- Create: `apps/cms/src/components/posts/post-editor/content-score/score-gauge.tsx`
- Create: `apps/cms/src/components/posts/post-editor/content-score/score-checks.tsx`
- Create: `apps/cms/src/components/posts/post-editor/content-score/content-score-panel.tsx`
- Modify: `apps/cms/src/components/posts/post-editor/properties-panel.tsx`

**Interfaces:**

- Consumes: `analysePost`, `guidelinesFromSettings`, `formatRange`, `scoreBand`, `SCORE_CATEGORIES` and the types from Task 5; `BrandFinding` from Task 4; `editor.contentTargets` from Task 2.
- Produces: `useContentScore(values: PostInput, targets: ContentTargets): ContentScore`; `<ContentScorePanel result={ContentScore} />`.

- [ ] **Step 1: The hook.** `use-content-score.ts`:

```ts
import {
  type ContentScore,
  type ContentTargets,
  type PostInput,
  analysePost,
  guidelinesFromSettings,
} from '@ll/content';
import { useEffect, useMemo, useState } from 'react';

/** `value`, once it has stopped changing for `delay` ms. The first value is used straight away. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** The content score for the editor's values, worked out again half a second after typing stops. */
export function useContentScore(values: PostInput, targets: ContentTargets): ContentScore {
  const settled = useSettled(values, 500);
  return useMemo(
    () => analysePost(settled, guidelinesFromSettings(targets, settled)),
    [settled, targets]
  );
}
```

- [ ] **Step 2: Shared colours.** `score-tone.ts`:

```ts
/** Text colours for good, middling and bad, in light and dark. */
export const tone = {
  good: 'text-emerald-700 dark:text-emerald-400',
  mid: 'text-amber-700 dark:text-amber-400',
  bad: 'text-destructive',
} as const;

export const bandTone = { high: tone.good, mid: tone.mid, low: tone.bad } as const;

export const bandStroke = {
  high: 'stroke-emerald-600 dark:stroke-emerald-400',
  mid: 'stroke-amber-500',
  low: 'stroke-destructive',
} as const;
```

- [ ] **Step 3: The gauge.** `score-gauge.tsx`:

```tsx
import { scoreBand } from '@ll/content';
import { cn } from '@/lib/utils';
import { bandStroke, bandTone } from './score-tone';

const ARC = 'M10 50 A40 40 0 0 1 90 50';

/** A half-circle meter. The number and a word always show, so colour is never the only signal. */
export function ScoreGauge({ score }: { score: number }) {
  const { band, label } = scoreBand(score);
  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`Content score ${score} out of 100: ${label}`}
    >
      <svg viewBox="0 0 100 56" className="w-36" aria-hidden>
        <path d={ARC} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-muted" />
        {score > 0 && (
          <path
            d={ARC}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${score} 100`}
            className={cn(
              'transition-[stroke-dasharray] duration-300 motion-reduce:transition-none',
              bandStroke[band]
            )}
          />
        )}
      </svg>
      <p className="-mt-8 text-2xl font-semibold tabular-nums">
        {score}
        <span className="text-muted-foreground text-xs font-normal">/100</span>
      </p>
      <p className={cn('text-xs', bandTone[band])}>{label}</p>
    </div>
  );
}
```

- [ ] **Step 4: The check list.** `score-checks.tsx`:

```tsx
import { type ContentScore, SCORE_CATEGORIES, type ScoreCheck } from '@ll/content';
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { tone } from './score-tone';

const ORDER = { critical: 0, warning: 1, pass: 2, skipped: 3 } as const;

const STATUS = {
  critical: { Icon: CircleAlertIcon, className: tone.bad, label: 'Critical' },
  warning: { Icon: TriangleAlertIcon, className: tone.mid, label: 'Warning' },
  pass: { Icon: CircleCheckIcon, className: tone.good, label: 'Passed' },
} as const;

/** Every check that applies, by category, problems first. */
export function ScoreChecks({ checks, categories }: Pick<ContentScore, 'checks' | 'categories'>) {
  return (
    <div className="space-y-4 pt-3">
      {SCORE_CATEGORIES.map(({ id, label }) => {
        const shown = checks
          .filter(
            (c): c is ScoreCheck & { status: keyof typeof STATUS } =>
              c.category === id && c.status !== 'skipped'
          )
          .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
        if (!shown.length) return null;
        return (
          <section key={id} aria-labelledby={`score-category-${id}`} className="space-y-1.5">
            <h4 id={`score-category-${id}`} className="flex justify-between text-xs font-medium">
              {label}
              <span className="text-muted-foreground tabular-nums">{categories[id]}</span>
            </h4>
            <ul className="space-y-2">
              {shown.map((c) => {
                const { Icon, className, label: statusLabel } = STATUS[c.status];
                return (
                  <li key={c.id} className="flex gap-2 text-xs">
                    <Icon aria-hidden className={cn('mt-0.5 size-3.5 shrink-0', className)} />
                    <div className="min-w-0">
                      <p>
                        <span className="sr-only">{statusLabel}: </span>
                        {c.message}
                      </p>
                      <p className="text-muted-foreground">{c.why}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: The panel.** `content-score-panel.tsx`:

```tsx
import {
  type BrandFinding,
  type ContentScore,
  type RangeState,
  type StructureCount,
  type TermUse,
  formatRange,
} from '@ll/content';
import { useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
} from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ScoreChecks } from './score-checks';
import { ScoreGauge } from './score-gauge';
import { tone } from './score-tone';

/** The score, structure counts, terms and brand problems for the post being edited. Advice only. */
export function ContentScorePanel({ result }: { result: ContentScore }) {
  const [details, setDetails] = useState(false);
  return (
    <div className="space-y-5 pt-3">
      <div className="flex flex-col items-center">
        <ScoreGauge score={result.score} />
        <Collapsible open={details} onOpenChange={setDetails} className="w-full">
          <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground touch:min-h-11 mx-auto flex min-h-8 items-center gap-1 text-xs">
            Details
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScoreChecks checks={result.checks} categories={result.categories} />
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Structure structure={result.structure} />
      <Terms terms={result.terms} />
      <Brand brand={result.brand} />
      <p className="text-muted-foreground text-xs">
        {result.source === 'settings'
          ? 'Targets from Settings.'
          : 'Targets from top-ranking pages.'}
      </p>
    </div>
  );
}

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-xs font-medium">
      {children}
    </h3>
  );
}

function Structure({ structure }: { structure: StructureCount[] }) {
  return (
    <section aria-labelledby="score-structure" className="space-y-2">
      <Heading id="score-structure">Structure</Heading>
      <dl className="grid grid-cols-4 divide-x text-center">
        {structure.map((s) => (
          <div key={s.key} className="min-w-0 px-1">
            <dt className="text-muted-foreground truncate text-[0.65rem] tracking-wide uppercase">
              {s.label}
            </dt>
            <dd className="flex items-center justify-center gap-0.5 font-semibold tabular-nums">
              {s.value.toLocaleString('en-AU')}
              <RangeMark state={s.state} />
            </dd>
            <dd className="text-muted-foreground text-[0.65rem] tabular-nums">
              {formatRange(s.target)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const RANGE_MARK = {
  within: { Icon: CheckIcon, className: tone.good, label: 'within target' },
  below: { Icon: ArrowUpIcon, className: tone.mid, label: 'below target' },
  above: { Icon: ArrowDownIcon, className: tone.mid, label: 'above target' },
} as const;

function RangeMark({ state }: { state: RangeState }) {
  const { Icon, className, label } = RANGE_MARK[state];
  return (
    <>
      <Icon aria-hidden className={cn('size-3', className)} />
      <span className="sr-only">{label}</span>
    </>
  );
}

const CHIP = {
  met: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  unused: 'bg-destructive/10 text-destructive',
} as const;

const CHIP_LABEL = {
  met: 'target met',
  partial: 'used, below target',
  unused: 'not used yet',
} as const;

function Terms({ terms }: { terms: TermUse[] }) {
  return (
    <section aria-labelledby="score-terms" className="space-y-2">
      <Heading id="score-terms">Terms</Heading>
      {terms.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add a focus keyword in Search listing to see how it is used.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <li
              key={`${term.kind}:${term.term}`}
              className={cn(
                'flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                CHIP[term.state],
                term.kind === 'focus' && 'font-medium'
              )}
            >
              <span className="min-w-0 truncate">{term.term}</span>
              <span className="tabular-nums opacity-80">
                {term.count}/{term.min}
              </span>
              <span className="sr-only">
                {CHIP_LABEL[term.state]}
                {term.kind === 'focus' ? ', focus keyword' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Brand({ brand }: { brand: BrandFinding[] }) {
  return (
    <section aria-labelledby="score-brand" className="space-y-2">
      <Heading id="score-brand">Brand language</Heading>
      {brand.length === 0 ? (
        <p className="text-muted-foreground text-xs">No brand language problems.</p>
      ) : (
        <ul className="space-y-1.5">
          {brand.map((finding) => {
            const critical = finding.severity === 'critical';
            const Icon = critical ? CircleAlertIcon : TriangleAlertIcon;
            return (
              <li key={`${finding.kind}:${finding.found}`} className="flex gap-2 text-xs">
                <Icon
                  aria-hidden
                  className={cn('mt-0.5 size-3.5 shrink-0', critical ? tone.bad : tone.mid)}
                />
                <span className="min-w-0">
                  <span className="sr-only">{critical ? 'Never use: ' : 'Check: '}</span>
                  <span className="font-medium">{finding.found}</span>
                  {finding.count > 1 && (
                    <span className="text-muted-foreground tabular-nums"> ×{finding.count}</span>
                  )}
                  <span className="text-muted-foreground"> → {finding.instead}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Mount it.** In `properties-panel.tsx`, import `{ ContentScorePanel } from './content-score/content-score-panel'` and `{ useContentScore } from './content-score/use-content-score'`. After `const { values, meta, update, contentLocked } = editor;` add:

```ts
const score = useContentScore(values, editor.contentTargets);
```

Make the score section the first one, and drop `first` from Properties:

```tsx
      <Section id="post-section-score" title="Content score" count={score.score} defaultOpen first>
        <ContentScorePanel result={score} />
      </Section>

      <Section title="Properties" defaultOpen>
```

Update the component's doc comment to "The sidebar beside the post: content score, properties, featured image, search listing, revisions."

- [ ] **Step 7: Check types, lint and tests.**
      Run: `bun run type-check && bun run lint && bun run --filter @ll/cms test:unit`
      Expected: PASS.

- [ ] **Step 8: Check it by hand.** Run `bun run dev:cms`. On desktop:

  - A new post shows a score with no errors in the console, and "Add a focus keyword…" under Terms.
  - Typing in the body changes the counts about half a second after you stop.
  - Adding a focus keyword fills the Terms chips. Typing the keyword in the first paragraph turns its chip amber, then green.
  - Typing "grave" or "EARTHSAPHE" lists them under Brand language and lowers the score.
  - Details opens the checks by category, problems first.
  - The collapsed section header shows the score number.
  - A read-only post still shows the panel.

  At 390px with touch emulation: the panel sits under the editor, nothing overflows sideways, and Details is easy to tap. Check it in dark mode too.

- [ ] **Step 9: Commit.**

```bash
bunx prettier --write apps/cms/src/components/posts/post-editor/content-score apps/cms/src/components/posts/post-editor/properties-panel.tsx
git add apps/cms/src/components/posts/post-editor
git commit -m "feat(cms): content score panel in the post editor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Whole-branch verification

- [ ] **Step 1: Run what CI runs.**
      Run: `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build`
      Expected: every step passes. Fix and recommit anything that does not.

- [ ] **Step 2: Confirm the website is untouched.**
      Run: `git diff master --stat -- apps/web`
      Expected: no output.

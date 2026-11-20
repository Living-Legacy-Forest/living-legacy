# CMS AI suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suggest buttons in the CMS that write a post's search title, description, excerpt, focus
keyword and tags, an image's alt text, and a rewrite for each brand problem, all checked against the
brand guide before an editor sees them.

**Architecture:** Pure logic (prompt building, the brand guard, retry-once) lives in
`apps/cms/src/server/ai/` with no Workers imports, so it is unit tested against a fake client. Thin
`createServerFn` functions in `apps/cms/src/server/ai.ts` load what they need (site brand rules, the
image from R2) and call Claude Haiku 5.5 through `@anthropic-ai/sdk`. On the client, one
`SuggestButton` fills a field through its normal `onChange` and offers Undo.

**Tech Stack:** TanStack Start server functions on Cloudflare Workers, D1 + R2, Zod 4,
`@anthropic-ai/sdk`, React, shadcn on Base UI, Sonner via `lib/notify`, Vitest (unit + Miniflare
integration).

**Spec:** `docs/superpowers/specs/2026-11-20-cms-ai-suggestions-design.md`

## Global Constraints

- Model is `claude-haiku-5-5`, exported once as `AI_MODEL`. Do not use another model.
- No `temperature`, `top_p`, `top_k`, no assistant prefill, no `budget_tokens`. Set
  `output_config.effort: "low"`; leave `thinking` unset.
- Check `stop_reason` before reading content; `"refusal"` becomes a readable error.
- `max_tokens: 1024`.
- Key is the Worker secret `ANTHROPIC_API_KEY`; never sent to the browser, logged or committed.
- Send only the item's own text or image plus the brand guide. No filenames, names, emails, phone
  numbers, guest, event or team data.
- Every suggestion passes the guard: `findBrandProblems(text, brandRules)` has no `critical`
  finding, no `—` or `–`, no `!`, within the field limit. One retry on failure, then an error,
  never the text.
- Limits: `SEO_TITLE_LIMIT` 60, `SEO_DESCRIPTION_LIMIT` 160, `FOCUS_KEYWORD_LIMIT` 80, excerpt 500,
  alt text 300 (brief asks for under 125), at most 5 tags, each from the supplied list.
- Copy is plain, sentence case, Australian English. Errors are `notify.error` toasts, never inline.
  Pending uses `Spinner` from `components/ui/spinner`. Icons from `@/components/icons`.
- Tappable controls `touch:min-h-11`; nothing hover-only.
- Server functions follow the `AGENTS.md` shape (`createServerFn` + middleware + Zod validator) and
  throw `Error` with a sentence the editor can read. Never surface the provider's raw message.
- Who may ask for suggestions: any role with one of `posts:write`, `seo:write`, `content:write`,
  `media:write` (everyone but `viewer`). Alt text needs `media:write`.
- Commits are Conventional Commits, header at most 100 characters, ending with the
  `Co-Authored-By` line in use for this session. Run `bunx prettier --write` on touched files.

## Review Focus

- **The editor types in the field while a suggestion is on its way.** The suggestion must not
  overwrite what they typed. Expected: it is not applied, and a toast says the field changed. Test:
  Task 4, `applySuggestion` returns `null` when `current !== before`.
- **The model returns JSON that doesn't match the schema** (empty string, missing key, extra tags).
  Expected: treated like a guard failure and retried once, then a readable error. Test: Task 2,
  `runSuggestion` retries when `parsed_output` is `null`.
- **The model refuses** (`stop_reason: "refusal"`). Expected: "The writing assistant couldn't help
  with this one. Write it yourself." and no text. Test: Task 2.
- **A post with no title and no body.** Expected: "Write some of the post first." without calling
  the model. Test: Task 3.
- **A brand finding that sits somewhere the helper can't find** (for example, only in an image's
  alt text inside the body). Expected: no Suggest a fix button for it, rather than a button that
  fails. Test: Task 6, `locateFinding` returns `null`.

---

### Task 1: Find the sentence around a brand finding

**Files:**

- Create: `packages/content/src/brand-context.ts`
- Create: `packages/content/src/brand-context.test.ts`
- Modify: `packages/content/src/index.ts` (export it)
- Modify: `packages/content/src/brand-scan.ts` (each `never` finding gets `sentence`)
- Modify: `packages/content/src/brand-scan.test.ts`

**Interfaces:**

- Produces: `sentenceAround(text: string, found: string): string | null`. Returns the sentence
  (split on `.`, `?`, `!` or a newline, trimmed) holding the first case-insensitive whole-phrase
  match of `found`, or `null`.
- Produces: `BrandScanResult['never'][number]` gains `sentence: string`, the first sentence any
  scanned piece holds it in (the piece itself if it has no sentence break).

- [ ] **Step 1: Write the failing tests**

```ts
test('returns the sentence holding the word', () => {
  expect(sentenceAround('We plant trees. Each plot is mapped. Visit soon.', 'plot')).toBe(
    'Each plot is mapped.'
  );
});
test('matches case-insensitively and keeps the original casing', () => {
  expect(sentenceAround('Plots are shaded', 'plots')).toBe('Plots are shaded');
});
test('does not match inside another word', () => {
  expect(sentenceAround('A plotted course.', 'plot')).toBeNull();
});
test('null when absent', () => {
  expect(sentenceAround('Nothing here.', 'grave')).toBeNull();
});
// brand-scan.test.ts
test('each never finding carries its sentence', () => {
  const result = scanBrand(['Our forest is calm. Choose a plot today.']);
  expect(result?.never[0]).toMatchObject({ found: 'plot', sentence: 'Choose a plot today.' });
});
```

- [ ] **Step 2: Run** `bun run --filter @ll/content test` and check the new tests FAIL.
- [ ] **Step 3: Implement** `sentenceAround`, using the same phrase matching as
      `brand-language.ts`'s `phraseRegex` (export it from there rather than copying). In `scanBrand`,
      record the first `sentenceAround(piece, finding.found)` per merge key.
- [ ] **Step 4: Run** `bun run --filter @ll/content test` and check everything PASSES.
- [ ] **Step 5: Commit** `feat(content): find the sentence around a brand finding`

---

### Task 2: The AI core: prompts, guard and retry, against a fake client

**Files:**

- Modify: `apps/cms/package.json` (`cd apps/cms && bun add @anthropic-ai/sdk`)
- Create: `apps/cms/src/server/ai/fields.ts`. The field specs.
- Create: `apps/cms/src/server/ai/guard.ts`
- Create: `apps/cms/src/server/ai/run.ts`
- Create: `apps/cms/src/server/ai/guard.test.ts`, `apps/cms/src/server/ai/run.test.ts`

None of these import `cloudflare:workers`.

**Interfaces:**

- Produces (`fields.ts`):
  - `AI_MODEL = 'claude-haiku-5-5'`
  - `type SuggestField = 'seoTitle' | 'seoDescription' | 'excerpt' | 'focusKeyword' | 'tags' | 'alt' | 'brandFix'`
  - `FIELD_SPECS: Record<SuggestField, { limit: number; brief: string }>`. Briefs are one or two
    sentences each, saying what the field is for. The `alt` brief says to describe what is visible,
    under 125 characters, without "image of" or "photo of". The `brandFix` brief says to rewrite
    only the given text, keep its meaning, and replace the flagged word as the guide says.
  - `systemPrompt(brandGuide: string, field: SuggestField): Anthropic.TextBlockParam[]`. Block 1 is
    the brand guide plus the general rules (the reply is only the field's text; Australian English;
    sentence case; no em or en dashes; no exclamation marks; no quotes around the reply). Block 2
    is the field brief and its limit. The guide goes first so it can be cached.
- Produces (`guard.ts`): `guardProblems(text: string, opts: { limit: number; rules: readonly BrandRule[]; allowed?: readonly string[] }): string[]`.
  Returns one plain sentence per problem, each written so it can be fed back to the model (for
  example `Do not use "plot"; write "Legacy Ground, or their tree" instead.`). An empty array means
  it passed.
- Produces (`run.ts`):
  - `type AiClient = Pick<Anthropic, 'messages'>`
  - `class SuggestError extends Error`, whose messages are the user-facing sentences below.
  - `runSuggestion<T extends z.ZodType>(client: AiClient, req: { field: SuggestField; brandGuide: string; rules: readonly BrandRule[]; content: Anthropic.ContentBlockParam[]; schema: T; texts: (out: z.infer<T>) => string[]; allowed?: readonly string[] }): Promise<z.infer<T>>`.
    It calls `client.messages.parse` with `model: AI_MODEL`, `max_tokens: 1024`,
    `output_config: { effort: 'low', format: zodOutputFormat(schema) }`, top-level
    `cache_control: { type: 'ephemeral' }`, the system blocks and one user message. Each string
    from `texts(out)` is guarded. On a `null` `parsed_output` or any guard problem it retries
    once, adding a user message that lists the problems. Then it throws.
  - User-facing messages: guard failed twice: "Couldn't write one that follows the brand guide.
    Try again or write it yourself." Refusal: "The writing assistant couldn't help with this one.
    Write it yourself." `Anthropic.RateLimitError`: "The writing assistant is busy. Try again in a
    moment." Any other `Anthropic.APIError` or connection error: "The writing assistant isn't
    answering. Try again soon."
  - It logs `{ field, model, input_tokens, output_tokens, outcome }` with `console.info`, where
    `outcome` is `'ok' | 'retried' | 'guard_failed' | 'refused' | 'error'`, and no content.

- [ ] **Step 1: Write the failing guard tests.** `guardProblems` flags: `'Choose a plot'` (a
      critical rule from `BRAND_RULES`), `'Calm — and green'`, `'Visit us!'`, a 61-character string
      with `limit: 60`, and `allowed: ['Events']` with the text `'Gardening'`. It returns `[]` for
      `'A quiet walk through Living Legacy Mornington'` with `limit: 60`.
- [ ] **Step 2: Write the failing run tests** with a fake `AiClient` whose `messages.parse` returns
      queued responses:
  - passes on the first try → one call, returns the parsed value
  - the first reply contains "plot", the second is clean → two calls, and the second call's last
    user message contains `Do not use "plot"`
  - two dirty replies → throws `SuggestError` "Couldn't write one that follows the brand guide. Try
    again or write it yourself."
  - `parsed_output: null`, then a clean reply → two calls, returns the clean value
  - `stop_reason: 'refusal'` → throws the refusal message and does not retry
  - `parse` throws `new Anthropic.RateLimitError(...)` → throws the busy message
  - the request has `model: 'claude-haiku-5-5'`, `max_tokens: 1024`, `output_config.effort: 'low'`,
    and no `temperature` or `thinking` keys
- [ ] **Step 3: Run** `bun run --filter @ll/cms test:unit -- src/server/ai` and check they FAIL.
- [ ] **Step 4: Implement** `fields.ts`, `guard.ts` and `run.ts` with the signatures above. If
      `zodOutputFormat` fails to bundle or run on Workers (`new Function`), use
      `output_config.format: { type: 'json_schema', schema: z.toJSONSchema(schema) }` with
      `messages.create`, parse the text block with `schema.safeParse`, and say so in the PR.
- [ ] **Step 5: Run** the unit tests again and check they PASS.
- [ ] **Step 6: Commit** `feat(cms): writing assistant core with brand guard and one retry`

---

### Task 3: Server functions, key handling and alt text from R2

**Files:**

- Create: `apps/cms/src/server/ai/client.ts`
- Create: `apps/cms/src/server/ai/alt-image.ts` (reads the image block from R2)
- Create: `apps/cms/src/server/ai.ts` (the server functions)
- Create: `apps/cms/src/server/ai.integration.test.ts`
- Modify: `apps/cms/.dev.vars.example`, `apps/cms/worker-configuration.d.ts` (add
  `ANTHROPIC_API_KEY` as optional, the way `POSTHOG_PERSONAL_API_KEY` is), `README.md`
  (environment variables: what it is for, and that the Suggest buttons are hidden without it)

**Interfaces:**

- Consumes: `runSuggestion`, `SuggestError`, `FIELD_SPECS`, `AiClient` (Task 2);
  `loadContentTargets(db).brandRules` (`server/post-score.ts`); the brand guide via
  `import brandGuide from '../../../../docs/brand-language.md?raw'` (as `mcp.ts` does).
- Produces (`client.ts`): `getAiClient(): AiClient | null`. Returns `new Anthropic({ apiKey })`
  from `env.ANTHROPIC_API_KEY`, or `null` when unset.
- Produces (`alt-image.ts`): `loadAltImage(db: Db, bucket: R2Bucket, mediaId: string): Promise<{ block: Anthropic.ImageBlockParam; caption: string | null }>`.
  It picks the largest variant with `width <= 1568`, else the original. It throws `SuggestError`:
  "Alt text can only be suggested for photos and images." when the mime type is not
  `image/jpeg`, `image/png`, `image/gif` or `image/webp`. It throws "This image is too large to
  describe. Replace it with a smaller copy." when the chosen object is over 5 MB. It throws "That
  image is no longer in Media." when the row or object is missing.
- Produces (`ai.ts`). Every function is `POST`, except `getAiStatus`:
  - `getAiStatus`: `GET`, `authMiddleware`, returns `{ enabled: boolean }`. `enabled` is true when
    the key is set and the role has one of the four permissions in Global Constraints.
  - `suggestPostField` validator `{ field: 'seoTitle'|'seoDescription'|'excerpt'|'focusKeyword'|'tags', title: string (max 300), excerpt: string (max 500), bodyMarkdown: string (max 200_000), tagNames: string[] (max 500, each max 60) }`,
    returns `{ text: string } | { tags: string[] }`. For `tags`, the schema is
    `{ tags: string[] }` with at most 5, and `allowed` is `tagNames`.
  - `suggestAltText` validator `{ mediaId: string }`, middleware
    `requirePermission('media:write')`, returns `{ text: string }`.
  - `suggestBrandFix` validator `{ text: string (max 2000), found: string (max 100), limit: number (int, 1–2000) }`,
    returns `{ text: string }`. The guard uses the given `limit`.
  - Each function except `getAiStatus` throws "The writing assistant isn't set up." when
    `getAiClient()` is `null`. Post-field and brand-fix calls throw "You do not have permission to
    do that." for a role with none of the four permissions.
  - `suggestPostField` throws "Write some of the post first." when `title`, `excerpt` and
    `bodyMarkdown` are all blank after trimming, before calling the model.

- [ ] **Step 1: Write the failing integration tests.** Mock `@/server/ai/client` with `vi.mock` so
      `getAiClient` returns a fake whose `parse` returns a clean reply. Put objects in `env.MEDIA` and
      rows in `media`.
  - `loadAltImage` on a PNG row with a 1200px variant and a 3000px original → the block's base64
    decodes to the variant's bytes and `media_type` is `'image/png'`
  - `loadAltImage` on an `image/svg+xml` row → throws "Alt text can only be suggested for photos
    and images."
  - `loadAltImage` on a 6 MB original with no variants → throws the too-large message
  - the request the fake receives for alt text has an `image` block and no text containing the
    filename
  - `suggestPostField` with an empty title, excerpt and body → throws "Write some of the post
    first." and the fake is never called
  - with `getAiClient` returning `null` → `suggestBrandFix` throws "The writing assistant isn't
    set up."

  Test the handlers through small exported functions (`suggestPostFieldFor(db, client, input,
role)` and so on) that the server functions wrap, the way other `*-store.ts` files are tested.

- [ ] **Step 2: Run** `bun run --filter @ll/cms test:integration -- src/server/ai` and check they FAIL.
- [ ] **Step 3: Implement** `client.ts`, `alt-image.ts` and `ai.ts`. Base64 the R2 object with
      `Buffer.from(await object.arrayBuffer()).toString('base64')` (`nodejs_compat`). For alt text, the
      user content is the image block plus, when present, "Its caption: …".
- [ ] **Step 4: Run** the integration tests again and check they PASS, then run `bun run type-check`.
- [ ] **Step 5: Commit** `feat(cms): server functions for post, alt text and brand fix suggestions`

---

### Task 4: The Suggest button, on post fields

**Files:**

- Modify: `apps/cms/src/routes/_app.tsx`. Add `ai: boolean` to the `beforeLoad` context from
  `getAiStatus`, cached in the browser for the session like `getCachedUser`.
- Create: `apps/cms/src/components/ai/use-can-suggest.ts`
- Create: `apps/cms/src/components/ai/suggest-button.tsx`
- Create: `apps/cms/src/components/ai/apply-suggestion.ts`, `apply-suggestion.test.ts`
- Modify: `apps/cms/src/components/posts/post-editor/seo-fields.tsx` (Title, Description, Focus
  keyword)
- Modify: `apps/cms/src/components/posts/post-editor/properties-panel.tsx` (Summary, which is the
  excerpt, and Tags)
- Possibly modify: `apps/cms/src/components/icons.tsx`, to export a sparkles icon if none exists

**Interfaces:**

- Consumes: `getAiStatus`, `suggestPostField` (Task 3).
- Produces: `useCanSuggest(): boolean`. Reads `ai` from `useRouteContext({ from: '/_app' })`.
- Produces: `applySuggestion({ before, current, suggestion }: { before: string; current: string; suggestion: string }): string | null`.
  Returns `suggestion` when `current === before`, otherwise `null`.
- Produces: `<SuggestButton label?: string; value: string; request: () => Promise<string>; onApply: (next: string) => void; read: () => string />`.
  The label is "Suggest" when `value` is blank and "Rewrite" otherwise. It shows `Spinner` while
  pending and is disabled while pending. On success it calls `applySuggestion` with the value
  captured at click time and `read()`. If that applies, it calls `onApply` and shows
  `notify.success({ title: 'Suggestion added', description: 'Check it, then save as usual.', action: { label: 'Undo', onClick: () => onApply(before) } })`.
  If it returns `null`, it shows
  `notify.info({ title: 'Suggestion not added', description: 'The field changed while it was being written. Try again.' })`.
  On error it shows `notify.error('Could not suggest one', error)`. It renders `null` when
  `useCanSuggest()` is false. Use a plain pending state, not `useAction()`: nothing is saved, so the
  loaders shouldn't refresh.
- For tags, a sibling `SuggestTagsButton` calls `suggestPostField({ field: 'tags' })` and adds the
  returned names to `values.tags` (no duplicates), with the same Undo.

- [ ] **Step 1: Write the failing test** for `applySuggestion`: it applies when `current ===
before`, returns `null` when the editor typed meanwhile, and applies when `before` and `current`
      are both `''`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- apply-suggestion` and check it FAILS.
- [ ] **Step 3: Implement** the hook, `applySuggestion`, `SuggestButton` and `SuggestTagsButton`,
      and place them beside each field's label. The body is sent as
      `richTextToMarkdown(values.body).markdown`. Buttons sit inside the existing fieldsets, so read-only
      posts disable them.
- [ ] **Step 4: Run** the unit tests and `bun run type-check`, and check they PASS. Then
      `bun run dev:cms` with a real key in `.dev.vars`: open a post, press Suggest on Description, see
      the Spinner, then text and a toast with Undo. Check that Undo restores the old text. Check at
      390px with touch emulation that the buttons are at least 44pt.
- [ ] **Step 5: Commit** `feat(cms): suggest search fields, summary and tags in the post editor`

---

### Task 5: Suggest alt text

**Files:**

- Modify: `apps/cms/src/components/media/image-field.tsx` (`AltText`)
- Modify: `apps/cms/src/components/media/media-detail.tsx` (the `m-alt` field)

**Interfaces:**

- Consumes: `SuggestButton` (Task 4), `suggestAltText` (Task 3).

- [ ] **Step 1: Add** a `SuggestButton` beside both alt inputs, with
      `request = () => suggestAltText({ data: { mediaId } }).then((r) => r.text)`. Leave it out for
      documents (`isDocument`). In `image-field`, `onApply` sets the local `alt` and then calls the
      existing `save()`, because that field saves on blur. Its Undo restores the old value and saves
      again. In `media-detail`, `onApply` sets `alt`, so it shows as unsaved until the panel's Save.
- [ ] **Step 2: Check by hand** in `bun run dev:cms`: suggest alt text for a JPEG in Media and in a
      post's featured image picker. An SVG shows the "photos and images" toast. The buttons are 44pt at
      390px.
- [ ] **Step 3: Run** `bun run type-check && bun run lint` and check both PASS.
- [ ] **Step 4: Commit** `feat(cms): suggest alt text for images`

---

### Task 6: Suggest a fix for brand problems

**Files:**

- Create: `apps/cms/src/components/ai/locate-finding.ts`, `locate-finding.test.ts`
- Create: `apps/cms/src/components/ai/brand-fix-button.tsx`
- Modify: `apps/cms/src/components/posts/post-editor/content-score/content-score-panel.tsx`
  (`Brand`: give it `values` and `update`)
- Modify: `apps/cms/src/components/posts/post-editor/properties-panel.tsx` (pass them through)
- Modify: `apps/cms/src/server/content-checks.ts` (keep `sentence` in `BrandBreach['never']`)
- Modify: `apps/cms/src/components/checks/content-checks-page.tsx` (a fix button per shown finding)

**Interfaces:**

- Consumes: `sentenceAround`, `scanBrand`'s `sentence` (Task 1); `suggestBrandFix` (Task 3);
  `useCanSuggest` (Task 4).
- Produces: `locateFinding(values: Pick<PostInput, 'title'|'excerpt'|'seoTitle'|'seoDescription'|'body'>, found: string): { field: 'title'|'excerpt'|'seoTitle'|'seoDescription'|'body'; sentence: string } | null`.
  It searches the fields in that order, and the body through `outlineRichText(values.body).text`.
- Produces: `<BrandFixButton sentence: string; found: string; limit: number; apply?: (rewrite: string) => void />`.
  The "Suggest a fix" button opens a `Popover` (`components/ui/popover`) that shows the original
  sentence, a Spinner, then the rewrite. It has **Copy**, which uses `navigator.clipboard.writeText`
  and shows `notify.success({ title: 'Copied', description: 'Paste it in place of the sentence.' })`.
  When `apply` is given it also has **Use it**. Errors are `notify.error('Could not suggest a fix', error)`.
- Limits passed: title uses the post title's Zod max from `@ll/content`, `excerpt` 500,
  `seoTitle` 60, `seoDescription` 160, body 2000.

- [ ] **Step 1: Write the failing tests** for `locateFinding`:
  - "plot" in `excerpt` only → `{ field: 'excerpt', sentence: … }`
  - "plot" in both `title` and the body → the field is `'title'`
  - "plot" only in a body paragraph → `{ field: 'body', sentence: … }`
  - "plot" in none of the searched fields → `null`
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- locate-finding` and check they FAIL.
- [ ] **Step 3: Implement** `locateFinding` and `BrandFixButton`. In the post editor's `Brand`, give
      each critical finding where `locateFinding` is not `null` a `BrandFixButton`. For any field other
      than the body, `apply` sets the field to `value.replace(sentence, rewrite)` through `update`, with
      the same Undo toast as Task 4. For the body, there's no `apply` (Copy only). On the checks page,
      give each finding shown by `brandDetail` its own `BrandFixButton` with its `sentence`, no `apply`
      and limit 2000, next to the existing Open link.
- [ ] **Step 4: Run** the unit tests, `bun run type-check` and
      `bun run --filter @ll/cms test:integration -- content-checks` (the existing tests still pass
      with `sentence` added), and check they PASS. Check by hand: a post whose excerpt says "plot"
      gets fixed in place with Use it, and a body finding gets a working Copy.
- [ ] **Step 5: Commit** `feat(cms): suggest a fix for brand language problems`

---

### Task 7: What's new and the full check

**Files:**

- Modify: `apps/cms/src/lib/whats-new.ts`. Add the new entry at the top, `id` set to the ship date
  (`YYYY-MM-DD`, with `-2` if that day already has one), `kind: 'new'`.

- [ ] **Step 1: Add the entry.** Title "Suggestions as you write". Items:
  - "Suggest search text, a summary and tags": "In a post, the Suggest button beside Title,
    Description, Focus keyword, Summary and Tags writes one for you, following the brand guide.
    Check it, then save as usual. Undo puts back what was there."
  - "Suggest alt text": "Beside alt text in Media and in image pickers, Suggest looks at the image
    and describes it for screen readers." Link `{ label: 'Open Media', to: '/media' }`.
  - "Suggest a fix for brand problems": "Each brand language problem in a post's content score,
    and on Content checks, has Suggest a fix, which rewrites that sentence." Link
    `{ label: 'Open Content checks', to: '/checks' }`.
- [ ] **Step 2: Run the CI set from the repo root**: `bun run type-check && bun run lint &&
bun run format:check && bun run test && bun run build`. Expected: all pass.
- [ ] **Step 3: Check against the real model by hand** with five real posts and five real images.
      Read each suggestion for tone and the approved names. Note anything off in the PR.
- [ ] **Step 4: Commit** `docs(cms): what's new for writing suggestions`

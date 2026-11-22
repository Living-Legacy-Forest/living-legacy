# Profile banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person can upload, replace and remove a profile banner, shown in an X-style header with the avatar overlapping it, and a palette gradient fills the space until they do.

**Architecture:** Pure helpers in `lib/banner.ts`; R2 ownership and cleanup in `lib/banners.ts` and `server/banner-store.ts`; two server functions; an upload route and a serve route mirroring avatars; one new `ProfileBanner` component and a header restructure in the profile page.

**Tech Stack:** TanStack Start (CMS), Better Auth, Drizzle on D1, R2, Vitest (unit and Miniflare integration), shadcn on Base UI, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-22-profile-banner-design.md`

## Global Constraints

- One new optional column `user.banner` via a new migration (`bun run --filter @ll/db generate -- --name user-banner`, then `bun run --filter @ll/cms db:migrate:local`). Never edit a shipped migration.
- Files live in R2 as `banner-<uuid>.<ext>`, served from `/api/banner/<key>`, tagged `customMetadata.userId`.
- `banner` is `input: false` in Better Auth; it changes only through `setMyBanner` and `clearMyBanner`.
- Uploads: 5 MB maximum; JPEG, PNG, WebP, AVIF, GIF; the bytes must read as an image (`imageSize`).
- The banner is decorative: `alt=""` and `aria-hidden`.
- Loading uses the shadcn `Spinner`; icons from `@/components/icons`; touch targets `touch:min-h-11`; check at 390px.
- Copy: plain, sentence case, Australian English. Commits are Conventional Commits (body lines wrapped at 100) and end with the attribution line the session gives.
- Branch `feat/profile-banner` comes off `master`; the PR targets `master`.

## Review Focus

1. `setMyBanner` with a URL that is not a banner, or a banner file tagged to another user: rejected, and the caller's current banner is untouched. (Task 3)
2. The daily orphan sweep keeps a file a user's `banner` points at, so a banner does not vanish after the upload grace period. (Task 3)
3. Replace and remove delete the caller's old file and never another person's. (Task 3)
4. A text file renamed `.png`, a file over 5 MB, and a type outside the list are all refused at upload. (Task 3, checked by hand)
5. A banner whose file is gone (404) falls back to the gradient instead of a broken image; no banner at all shows the gradient. (Task 4)

---

### Task 1: Pure banner helpers

**Files:**

- Create: `apps/cms/src/lib/banner.ts`, `apps/cms/src/lib/banner.test.ts`

**Interfaces:**

- Produces:
  - `BANNER_ASPECT = 3`
  - `bannerUrl(key: string): string` → `/api/banner/<key>`
  - `bannerKey(url: string | null | undefined): string | null` — the storage key when `url` is exactly `/api/banner/banner-<word chars or hyphens>.<lowercase letters or digits>`; null for anything else.
  - `bannerHueShift(seed: string): number` — a stable integer from 0 to 40 for a seed (a person's id).

- [ ] **Step 1: Write the failing tests.** `bannerKey` returns `banner-3f2a-9b.webp` for `/api/banner/banner-3f2a-9b.webp` and null for: `/api/avatar/avatar-x.png`, `/api/banner/banner-a.png?x=1`, `/api/banner/../banner-a.png`, `https://evil.test/api/banner/banner-a.png`, `/api/banner/banner-.PNG`, `''`, `null`, `undefined`. `bannerUrl('banner-a.png')` round-trips through `bannerKey`. `bannerHueShift('abc')` is the same on two calls, is an integer within 0 to 40 for a spread of 50 seeds including `''`, and gives at least 5 distinct values across those 50.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- banner` — expect FAIL.
- [ ] **Step 3: Implement** in `banner.ts`; the hash is any simple string hash reduced modulo 41.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(cms): helpers for profile banners`.

---

### Task 2: The `banner` column and session field

**Files:**

- Modify: `packages/db/src/schema/auth.ts` (add `banner: text('banner')` after `avatarSeed`, with a comment)
- Create: `packages/db/migrations/0043_user-banner.sql` (generated)
- Modify: `apps/cms/src/lib/auth.ts:59-66` (add `banner: { type: 'string', required: false, input: false }`)
- Modify: `apps/cms/src/lib/session-user.ts` (`SessionUser.banner: string | null`, `RawSessionUser.banner?: unknown`, mapped in `toSessionUser`), `apps/cms/src/lib/session-user.test.ts`

**Interfaces:**

- Produces: `SessionUser.banner: string | null`; `user.banner` in the Drizzle schema.

- [ ] **Step 1: Write the failing test** in `session-user.test.ts`: a raw user with `banner: '/api/banner/banner-a.png'` maps to that string; with no `banner`, or `banner: 5`, maps to `null`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit -- session-user` — expect FAIL.
- [ ] **Step 3: Implement** the schema column, generate the migration, apply it locally (`bun run --filter @ll/cms db:migrate:local`), update `auth.ts` and `session-user.ts`. The generated SQL must be only an `ALTER TABLE ... ADD` of a nullable column; if it contains anything else, stop and report.
- [ ] **Step 4: Run** `bun run type-check && bun run --filter @ll/cms test` — expect PASS. Fix any `SessionUser` object the type-check flags (tests, fixtures) by adding `banner: null`.
- [ ] **Step 5: Commit** `feat(db): add a banner to users`.

---

### Task 3: Storage, server functions and routes

**Files:**

- Create: `apps/cms/src/lib/banners.ts`, `apps/cms/src/server/banner-store.ts`, `apps/cms/src/server/banner-store.integration.test.ts`
- Create: `apps/cms/src/routes/api/banner/index.ts` (upload), `apps/cms/src/routes/api/banner/$key.ts` (serve)
- Modify: `apps/cms/src/server/profile.ts` (add `setMyBanner`, `clearMyBanner`), `apps/cms/src/server/media-sweep.ts`, `apps/cms/src/server/daily-jobs.integration.test.ts` (one sweep case)

**Interfaces:**

- Consumes: `bannerKey`, `bannerUrl` (Task 1); `user.banner` and `SessionUser.banner` (Task 2).
- Produces:
  - `deleteOwnBanner(url: string | null | undefined, userId: string): Promise<void>` in `lib/banners.ts` — deletes the object only when `bannerKey(url)` is set and its `customMetadata.userId` equals `userId` (copy the pattern of `lib/avatars.ts`).
  - `adoptBanner(db: Db, userId: string, current: string | null, url: string): Promise<void>` in `banner-store.ts` — throws `That banner could not be used.` unless `bannerKey(url)` is set and the R2 object exists tagged to `userId`; then deletes `current` (when different from `url`) with `deleteOwnBanner` and sets `user.banner` and `updatedAt`.
  - `removeBanner(db: Db, userId: string, current: string | null): Promise<void>` — deletes the file, sets `user.banner` to null.
  - `setMyBanner({ url })` and `clearMyBanner()` server functions (`authMiddleware`), thin wrappers over the two store functions with `getDb()` and `context.user`.
  - `POST /api/banner/` → `{ url }` (signed-in, self only; does not touch the user row); `GET /api/banner/$key` serves only keys starting `banner-`, with the same headers as `/api/avatar/$key`.

- [ ] **Step 1: Write the failing integration tests** (`addUser` from `test/fixtures.ts`; put objects with `env.MEDIA.put(key, bytes, { customMetadata: { userId } })`): `adoptBanner` with the caller's own object sets the column and keeps the file; with an object tagged to another user throws `That banner could not be used.` and leaves the column and both files unchanged; with `/api/avatar/avatar-x.png` or a banner URL whose object does not exist throws the same; adopting a second banner deletes the first file but not an object tagged to someone else that `current` happens to name; `removeBanner` deletes the caller's file and nulls the column, and does not delete a file tagged to someone else. In `daily-jobs.integration.test.ts`, a banner object older than the upload grace period that a user row points at survives `sweepOrphanedMedia`, and one nothing points at is deleted.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:integration -- banner-store daily-jobs` — expect FAIL.
- [ ] **Step 3: Implement** `banners.ts`, `banner-store.ts`, the two server functions, and the sweep change (select `user.banner` too and add `bannerKey(u.banner)` to the referenced set). The upload route copies the avatar route's checks verbatim (5 MB, the five types, `imageSize(bytes)`), uses the key `banner-${crypto.randomUUID()}.${imageExtension(file.type)}`, and returns `{ url: bannerUrl(key) }`.
- [ ] **Step 4: Run** the same command plus `bun run type-check && bun run lint` — expect PASS.
- [ ] **Step 5: Commit** `feat(cms): store, serve and sweep profile banners`.

---

### Task 4: The header, the gradient and the banner control

**Files:**

- Create: `apps/cms/src/components/profile/profile-banner.tsx`
- Modify: `apps/cms/src/components/profile/profile-page.tsx` (the "who you are at a glance" block at lines 198-287), `apps/cms/src/styles.css` (the default gradient), `apps/cms/src/lib/whats-new.ts` (entry linking to `/profile`)

**Interfaces:**

- Consumes: `bannerUrl`, `bannerHueShift`, `BANNER_ASPECT` (Task 1); `SessionUser.banner` (Task 2); `setMyBanner`, `clearMyBanner` (Task 3); `useImageUpload` (`components/media/image-crop-dialog.tsx`).
- Produces: `ProfileBanner({ banner, seed, onChanged }: { banner: string | null; seed: string; onChanged: () => Promise<void> })` — renders the banner strip with its own edit menu and upload.

- [ ] **Step 1: Implement `ProfileBanner`.** A rounded strip, `aspect-[3/1]` capped near 13rem on desktop and shorter on phones. It shows the image (`alt=""`, `aria-hidden`, `object-cover`) when `banner` is set and loads, and otherwise a `div` with the class `profile-banner-default` and `style={{ '--banner-shift': bannerHueShift(seed) }}`. If the image errors, it falls back to the gradient. A camera button at the top right (always visible, `touch:min-h-11`) opens a `DropdownMenu`: "Upload a banner" (opens a hidden file input, then `useImageUpload` with `aspect: BANNER_ASPECT`, uploading to `POST /api/banner/`, then `setMyBanner`), and "Remove banner" when one is set (`clearMyBanner`). A `Spinner` replaces the camera while uploading. Success toasts "Banner updated" and "Banner removed"; failures use `notify.error`. After each change call `onChanged()`.
- [ ] **Step 2: Add the gradient** in `styles.css` as `.profile-banner-default`: a soft diagonal gradient built from `--tint-l`, `--tint-c`, `--tint-h` (plus `--banner-shift` on the hue of the second stop), with a light and a dark variant (`--tint-l-dark` in dark mode). No text sits on it.
- [ ] **Step 3: Restructure the header** in `profile-page.tsx`: the banner on top; below it, the avatar at `size-24` with a `ring-4 ring-background` overlapping the banner by half its height (`-mt-12`), the name, email, role badge and member-since, and the bio when set; centred on phones. Keep the existing avatar menu, picker and "Choose an avatar" prompt working. Pass `onChanged={refresh}`.
- [ ] **Step 4: Add the What's new entry** at the top of `whats-new.ts` ("Add a banner to your profile", link "Open your profile" to `/profile`).
- [ ] **Step 5: Run** `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build` — expect all PASS.
- [ ] **Step 6: Check in a browser** on `localhost:3100/profile` at desktop and 390px: the default gradient under each of the five colour palettes (Settings, Language & appearance) in light and dark; upload a wide image and a tall one (crop dialog at 3:1); replace; remove; delete the stored file by hand and reload to see the gradient return. If the browser cannot be signed in, say so in the PR instead of claiming it was checked.
- [ ] **Step 7: Commit** `feat(cms): a banner and a polished header on the profile page`, push, and open a PR against `master`. List in the body: what changed, the migration, that the orphan sweep now keeps banners, and what was and was not checked in a browser.

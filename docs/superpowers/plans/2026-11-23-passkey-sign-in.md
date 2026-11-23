# Passkey Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let CMS users sign in with a passkey (Apple, Google, Windows Hello, password managers) in one step, in production only.

**Architecture:** Better Auth's official `@better-auth/passkey` add-on is registered beside the existing magic-link plugin, with a new `passkey` table. One pure helper decides whether passkeys are on (deployed build, on the `BETTER_AUTH_URL` origin); the server refuses the add-on's endpoints elsewhere and the login page, profile and app shell render passkey UI only when the flag is true.

**Tech Stack:** Bun monorepo, Cloudflare Workers, D1 + Drizzle, Better Auth 1.7.27, `@better-auth/passkey` (SimpleWebAuthn), TanStack Start, shadcn on Base UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-passkey-sign-in-design.md`

## Global Constraints

- Better Auth and every `@better-auth/*` package at exactly the same version, 1.7.27, matching `@better-auth/passkey`.
- Passkeys only in production: `!import.meta.env.DEV` and the request origin equals `new URL(env.BETTER_AUTH_URL).origin` (`https://cms.livinglegacy.com.au`).
- `rpID` = hostname of `BETTER_AUTH_URL`; `rpName` = `Living Legacy CMS`; `origin` = origin of `BETTER_AUTH_URL`.
- Passkeys never create accounts; invite-only stays.
- Copy: plain, sentence case, Australian English. Exact strings below are fixed by the spec.
- Icons from `@/components/icons`; pending states use the shadcn `Spinner`; mutations through `useAction()`; errors as toasts (`notify.error`), never inline.
- Tappable rows at least 44pt (`touch:min-h-11`); check at 390px with touch emulation.
- Never edit a shipped migration. Commits follow Conventional Commits, header ≤ 100 chars, body lines ≤ 100.
- CI gate: `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build`.

## Review Focus

1. **Cancelled passkey prompt** (user closes Face ID sheet): no error toast. Test in Task 5 (`isPasskeyCancel`).
2. **Preview or local host** (`*.workers.dev` version URL, `localhost:3100`): no passkey button, no nudge, and the server answers 403 to `/passkey/*`. Tests in Task 3 (`passkeysAllowed`).
3. **Removing a user with passkeys**: their passkeys go too (cascade). Test in Task 2.
4. **Nudge after "Not now"**: stays hidden for 30 days on that device, then may show again; never shows once a passkey exists. Tests in Task 3 (`shouldOfferPasskey`).
5. **Browser without passkey support** (old Safari, some in-app browsers): button and nudge hidden, email link still works. Covered by `shouldOfferPasskey({ supported: false })` in Task 3 and the `supported` gate in Tasks 5–7.

---

### Task 1: Upgrade Better Auth and add the passkey package

**Files:**

- Modify: `apps/cms/package.json`, `bun.lock` (and any other `package.json` that lists `better-auth`)

**Interfaces:**

- Produces: `@better-auth/passkey` importable as `passkey` (server) and `@better-auth/passkey/client` → `passkeyClient` (browser). Confirm both entry points from the package's `package.json` `exports` before Task 4.

- [ ] **Step 1:** `grep -rn '"better-auth"\|"@better-auth/' --include=package.json .` (excluding node_modules) to list every place it is pinned.
- [ ] **Step 2:** Set `better-auth` to `1.7.27` everywhere and add `"@better-auth/passkey": "1.7.27"` to `apps/cms/package.json` dependencies; run `bun install`.
- [ ] **Step 3:** Run the CI gate. Expected: all pass. If a Better Auth type or behaviour changed, fix it in this task (read its changelog 1.7.14 → 1.7.27 for breaking notes on `rateLimit`, `advanced.ipAddress`, `magicLink`).
- [ ] **Step 4:** `bun run dev:cms`, sign in by email link (dev prints the link; use `gede@sistercreatives.co`). Expected: lands on `/`.
- [ ] **Step 5:** Commit `chore(cms): upgrade Better Auth to 1.7.27 and add its passkey add-on`.

### Task 2: The passkey table

**Files:**

- Modify: `packages/db/src/schema/auth.ts`
- Create: `packages/db/migrations/00NN_passkey.sql` (generated)
- Test: `apps/cms/src/server/passkey-table.integration.test.ts`

**Interfaces:**

- Produces: `passkey` table export from `@ll/db/schema` with properties `id, name, publicKey, userId, credentialID, counter, deviceType, backedUp, transports, createdAt, aaguid` (property names must match the add-on's field names; check its schema in `node_modules/@better-auth/passkey` and follow it if it differs). Columns snake_case; `userId` references `user.id` with `onDelete: 'cascade'`; index on `user_id` and on `credential_id`.

- [ ] **Step 1: Write the failing test** `it('removes a user's passkeys with the user')`: `addUser()`, insert one passkey row for them, delete the user, expect `select().from(passkey)` to be `[]`.
- [ ] **Step 2:** `bun run --filter @ll/cms test:integration -- passkey-table`. Expected: FAIL (no `passkey` export).
- [ ] **Step 3:** Add the table; `bun run --filter @ll/db generate -- --name passkey`; `bun run --filter @ll/cms db:migrate:local`.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit `feat(db): a passkey table for passkey sign-in`.

### Task 3: When passkeys are on, and when to offer one

**Files:**

- Create: `apps/cms/src/lib/passkeys.ts`
- Test: `apps/cms/src/lib/passkeys.test.ts`

**Interfaces:**

- Produces (pure, no `cloudflare:workers` import):
  - `passkeysAllowed(opts: { dev: boolean; requestUrl: string; authUrl: string }): boolean`: true only when `!dev` and origins match.
  - `NUDGE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000`
  - `NUDGE_KEY = 'll:passkey-nudge-dismissed'` (localStorage, value = ms timestamp)
  - `shouldOfferPasskey(opts: { supported: boolean; passkeyCount: number; dismissedAt: number | null; now: number }): boolean`
  - `defaultPasskeyName(userAgent: string): string`: `'iPhone' | 'iPad' | 'Mac' | 'Android phone' | 'Windows PC' | 'This device'`

- [ ] **Step 1: Write failing tests**
  - `passkeysAllowed({ dev: false, requestUrl: 'https://cms.livinglegacy.com.au/login', authUrl: 'https://cms.livinglegacy.com.au' })` → `true`
  - same with `dev: true` → `false`
  - `requestUrl: 'https://abc123-living-legacy-cms.example.workers.dev/login'` → `false`
  - `requestUrl: 'http://localhost:3100/login'`, `authUrl: 'http://localhost:3100'`, `dev: true` → `false`
  - `shouldOfferPasskey({ supported: false, passkeyCount: 0, dismissedAt: null, now })` → `false`
  - `passkeyCount: 1` → `false`; `dismissedAt: now - days(29)` → `false`; `dismissedAt: now - days(31)` → `true`; `dismissedAt: null` → `true`
  - `defaultPasskeyName` for an iPhone Safari UA → `'iPhone'`, macOS Chrome UA → `'Mac'`, unknown → `'This device'`
- [ ] **Step 2:** `bun run --filter @ll/cms test:unit -- passkeys`. Expected: FAIL.
- [ ] **Step 3:** Implement the three functions and constants.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit `feat(cms): rules for when passkeys are on and when to offer one`.

### Task 4: Server side of passkeys

**Files:**

- Modify: `apps/cms/src/lib/auth.ts`, `apps/cms/src/lib/session.ts` (`getLoginOptions`), `packages/db/src/enums.ts`, `apps/cms/src/server/activity-log.ts` (only if the kind list needs nothing; `user` already covers it)
- Create: `apps/cms/src/server/passkeys.ts`
- Test: `apps/cms/src/server/passkeys.integration.test.ts`

**Interfaces:**

- Consumes: `passkeysAllowed` (Task 3), `passkey` table (Task 2).
- Produces:
  - `getLoginOptions()` now returns `{ google: boolean; passkeys: boolean }` (`passkeys` = `passkeysAllowed({ dev: import.meta.env.DEV, requestUrl: getRequest().url, authUrl: env.BETTER_AUTH_URL })`).
  - `getPasskeysEnabled` server fn (GET, `authMiddleware`) → `boolean`, same rule; used by profile and nudge.
  - Activity actions `'user.passkey_added'` and `'user.passkey_removed'` in `activityActions`.
  - `logPasskeyChange(db: Db, actor: { id: string; name: string }, action: 'user.passkey_added' | 'user.passkey_removed')` in `server/passkeys.ts`, returning the `logActivity` insert. Summaries: `'Added a passkey'`, `'Removed a passkey'`.

- [ ] **Step 1: Write failing integration test** `it('logs an added passkey against its owner')`: `await logPasskeyChange(testDb(), { id, name: 'Sam Tester' }, 'user.passkey_added')`, expect one `activityLog` row with `action: 'user.passkey_added'`, `actorId: id`, `summary: 'Added a passkey'`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement `logPasskeyChange` and the enum values.
- [ ] **Step 4:** In `auth.ts`: register `passkey({ rpID, rpName: 'Living Legacy CMS', origin })` after `magicLink`; add `passkey: schema.passkey` to the adapter schema; in `hooks.before`, throw `APIError('FORBIDDEN', { message: 'passkeys_off' })` for `ctx.path.startsWith('/passkey')` or `ctx.path === '/sign-in/passkey'` when `!passkeysAllowed({ dev: import.meta.env.DEV, requestUrl: ctx.request?.url ?? '', authUrl: env.BETTER_AUTH_URL })`; add a `hooks.after` that runs `logPasskeyChange` after a successful registration verify (`add` path) and `delete-passkey`, using the session user from `ctx.context`. Confirm exact endpoint paths from the add-on's source.
- [ ] **Step 5:** Extend `getLoginOptions`; add `getPasskeysEnabled`.
- [ ] **Step 6:** Run the CI gate. Expected: PASS.
- [ ] **Step 7:** Commit `feat(cms): passkey sign-in on the server, production only`.

### Task 5: Sign in with a passkey on the login page

**Files:**

- Modify: `apps/cms/src/lib/auth-client.ts`, `apps/cms/src/routes/login.tsx`, `apps/cms/src/components/login/sign-in.tsx`
- Create: `apps/cms/src/lib/passkey-errors.ts`, test `apps/cms/src/lib/passkey-errors.test.ts`

**Interfaces:**

- Consumes: `getLoginOptions().passkeys` (Task 4), `passkeyClient` (Task 1).
- Produces: `authClient.signIn.passkey`, `authClient.passkey.*` available app-wide; `isPasskeyCancel(error: unknown): boolean` (true for `NotAllowedError`/`AbortError` and the add-on's cancelled code).

- [ ] **Step 1: Failing test** for `isPasskeyCancel`: `new DOMException('x', 'NotAllowedError')` → `true`; `AbortError` → `true`; `new Error('boom')` → `false`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Add `passkeyClient()` to `authClient`. `SignIn` takes `passkeys: boolean`. When `passkeys && browserSupportsWebAuthn()` (from `@simplewebauthn/browser`, or the add-on's re-export):
  - primary button "Sign in with a passkey" (key icon from `@/components/icons`; add one there if missing) above the email field, then an "or" divider;
  - email input gets `autoComplete="username webauthn"`; on mount call `authClient.signIn.passkey({ autoFill: true })` once (guard against double-call in Strict Mode; abort on unmount);
  - button click → `authClient.signIn.passkey()`; `Spinner` while pending; success → `window.location.assign('/')`; failure that is not `isPasskeyCancel` → `notify.error('Could not sign in with a passkey', 'Try again or use an email link.')`.
- [ ] **Step 6:** Add `passkeys_off: 'Passkey sign-in is not available here. Use an email link instead.'` to `errorMessages` in `login.tsx`.
- [ ] **Step 7:** CI gate; check `/login` at 390px (touch) and desktop: passkey UI absent locally (flag false). Temporarily force the flag true in dev to eyeball layout, then revert.
- [ ] **Step 8:** Commit `feat(cms): sign in with a passkey from the login page`.

### Task 6: Passkeys on the profile

**Files:**

- Create: `apps/cms/src/components/profile/passkeys-section.tsx`
- Modify: `apps/cms/src/components/profile/profile-page.tsx`, `apps/cms/src/routes/_app/profile/index.tsx`

**Interfaces:**

- Consumes: `getPasskeysEnabled` (Task 4), `authClient.passkey.listUserPasskeys | addPasskey | updatePasskey | deletePasskey` (Task 5), `defaultPasskeyName` (Task 3), `isPasskeyCancel` (Task 5).
- Produces: `<PasskeysSection />`, rendered after `<DevicesSection />` only when the loader's `passkeys` is true.

- [ ] **Step 1:** Profile loader returns `{ activity, passkeys }` (`Promise.all` with `getPasskeysEnabled()`); pass `passkeys` to `ProfilePage`.
- [ ] **Step 2:** Build the section on `SettingsSection` like `DevicesSection`: title "Passkeys"; description "Sign in with Face ID, Touch ID or your device's lock instead of waiting for an email."; rows show name, "Synced" or "This device only" (from `backedUp`), and "Added <relative date>" (`formatRelative`); per-row Rename (inline input, save on Enter/blur) and Remove (`ConfirmBulkDelete`-style confirm: "Remove this passkey? You can still sign in with an email link."); "Add a passkey" button calls `addPasskey({ name: defaultPasskeyName(navigator.userAgent) })`; empty state "No passkeys yet." Errors via `notify.error`, cancels ignored.
- [ ] **Step 3:** CI gate; check the section at 390px and desktop with the flag forced on, then revert.
- [ ] **Step 4:** Commit `feat(cms): add, rename and remove passkeys from your profile`.

### Task 7: Offer a passkey after other sign-ins

**Files:**

- Create: `apps/cms/src/components/shell/passkey-nudge.tsx`
- Modify: `apps/cms/src/components/shell/app-shell.tsx`

**Interfaces:**

- Consumes: `getPasskeysEnabled`, `shouldOfferPasskey`, `NUDGE_KEY`, `NUDGE_SNOOZE_MS`, `defaultPasskeyName` (Tasks 3–4), `authClient.passkey.listUserPasskeys | addPasskey`, `isPasskeyCancel`.

- [ ] **Step 1:** `<PasskeyNudge />` mounted once in the app shell. On mount: if `getPasskeysEnabled()` and `browserSupportsWebAuthn()`, list passkeys, read `NUDGE_KEY`, and open a `Dialog` only if `shouldOfferPasskey(...)`. Copy: title "Sign in faster next time", body "Add a passkey and sign in with Face ID, Touch ID or your device's lock.", buttons "Add a passkey" (primary) and "Not now". "Not now" (and closing) writes `Date.now()` to `NUDGE_KEY`. Success → `notify.success({ title: 'Passkey added' })` and close.
- [ ] **Step 2:** CI gate; check at 390px and desktop with the flag forced on, then revert.
- [ ] **Step 3:** Commit `feat(cms): offer a passkey after signing in another way`.

### Task 8: What's new and the final check

**Files:**

- Modify: `apps/cms/src/lib/whats-new.ts`

- [ ] **Step 1:** Add an entry at the top: `id` = ship date (`YYYY-MM-DD`, with `-2` if that day already has one), `kind: 'new'`, title "Sign in with a passkey", one item: body "You can now sign in with Face ID, Touch ID or your device's lock instead of waiting for an email. Add a passkey from your profile, or tap Add a passkey when the CMS offers it. Email links still work.", link `{ label: 'Open your profile', to: '/profile' }`. (Drop this task if the user says so at review.)
- [ ] **Step 2:** Full CI gate. Expected: all pass.
- [ ] **Step 3:** Commit `docs(cms): what's new for passkey sign-in`.
- [ ] **Step 4 (after deploy, on production):** add a passkey on a Mac (Touch ID) and an iPhone (Face ID); sign out; sign in with the button and with autofill; remove one; confirm activity log entries; confirm a preview URL shows no passkey UI.

# Passkey sign-in for the CMS

Date: 2026-11-23. Status: approved.

## Why

Signing in should be fast and modern: one Face ID or Touch ID prompt instead of waiting for an
email. Today the CMS signs people in with an email link or Google (`apps/cms/src/lib/auth.ts`).
Passkeys become the quickest way in; email links and Google stay as the way to get started and the
fallback.

## Goals

- Sign in with a passkey in one step from the login page, on phones and desktops, including Apple
  passkeys (iCloud Keychain, Face ID, Touch ID), Google Password Manager, Windows Hello and
  password managers such as 1Password.
- Let each person add, rename and remove their own passkeys from their profile.
- Nudge people to add one after they sign in another way, so the fast path actually gets used.

## Non-goals

- Passkeys never create accounts. The CMS stays invite-only: a passkey can only be added by
  someone already signed in.
- No removal of email links or Google. No passkey-only accounts.
- No admin management of other people's passkeys (removing a user removes theirs).
- No Settings switch to turn passkeys off (unlike Google). Can be added later if wanted.
- No passkeys outside production: not in local dev, not on preview deployments.

## Anti-goals (a failure even if it works)

- Anyone locked out: a person who loses their device must still get in by email link.
- A sign-in path that skips invite-only, the session idle limit, or the IP rate limits.
- Prompts that nag: the add-a-passkey nudge must be easy to dismiss and stay dismissed.

## Approaches considered

1. **Better Auth's passkey add-on, `@better-auth/passkey` (chosen).** Plugs into the existing
   auth, so sessions, the session hooks, invite-only and rate limits apply unchanged. Built on
   SimpleWebAuthn, which uses Web Crypto and runs on Workers. Requires Better Auth 1.7.27 (we are
   on 1.7.14).
2. Our own WebAuthn code on SimpleWebAuthn. Full control, but we would mint sessions outside
   Better Auth: more code in the riskiest place, for no gain.
3. A hosted identity service (Cloudflare Access, Clerk, Auth0). Replaces the whole auth stack and
   breaks invite-only, roles and session settings.

The user chose 1.

## Design

### Server

- Upgrade `better-auth` (and its `@better-auth/*` packages) to 1.7.27 and add
  `@better-auth/passkey` at the matching version. Run the full test suite and sign in by email
  link and Google afterwards: the upgrade touches every sign-in.
- **Production only.** One helper decides whether passkeys are on: a deployed build
  (`!import.meta.env.DEV`) serving the request on the origin of `BETTER_AUTH_URL`
  (`https://cms.livinglegacy.com.au`). Local dev (`.dev.vars` sets localhost) and preview
  deployments (other hosts) get no passkey UI, and the server refuses the add-on's endpoints
  there. The login route and the profile receive the flag from their loaders, so nothing
  passkey-related renders or loads when it is off.
- Add `passkey()` to the plugins in `lib/auth.ts`:
  - `rpID`: the hostname of `BETTER_AUTH_URL` (a passkey only works on the address it was made
    for).
  - `rpName`: `Living Legacy CMS` (shown in the device's passkey prompt).
  - `origin`: the origin of `BETTER_AUTH_URL`.
- New Drizzle table `passkey` in `packages/db/src/schema/auth.ts`, matching the add-on's fields
  (id, name, public key, user id with `onDelete: 'cascade'`, credential id, counter, device type,
  backed up, transports, created at, AAGUID). Register it in the `drizzleAdapter` schema. New
  migration via `bun run --filter @ll/db generate -- --name passkey`.
- Rate limits: the add-on's sign-in and registration endpoints fall under Better Auth's limiter,
  which now keys on `CF-Connecting-IP` (PR #279).
- Activity log: adding and removing a passkey are logged ("added a passkey", "removed a
  passkey"), through an after-hook on the add-on's endpoints. Builder's call on the exact hook.

### Login page (`components/login/sign-in.tsx`)

```
  Sign in to the CMS
  ┌─────────────────────────────┐
  │  [ 🔑 Sign in with a passkey ] │   ← primary button, top
  ├──────────── or ─────────────┤
  │  Email  [ you@…           ] │   ← tapping it can offer a passkey (autofill)
  │  [ Email me a link ]        │
  │  [ Continue with Google ]   │
  └─────────────────────────────┘
```

- A "Sign in with a passkey" button above the email field. Shown only in production and when the
  browser supports passkeys; hidden otherwise.
- Passkey autofill (WebAuthn conditional UI) on the email field: `autocomplete="username webauthn"`
  and a conditional request started when the page loads, so the browser offers saved passkeys as
  soon as the field is focused.
- A cancelled prompt does nothing (no error). A real failure shows a toast: "Could not sign in
  with a passkey. Try again or use an email link."
- On success, the same redirect as an email link.

### Profile → Passkeys (new section beside Devices)

- Lists this person's passkeys: name, where it is kept (synced or this device only, from
  `backedUp`), and when it was added.
- "Add a passkey" button; the default name comes from the device (for example "iPhone" or
  "Mac"), editable afterwards. Rename and remove per row; remove asks to confirm.
- Empty state: one line explaining what a passkey is and the add button.

### Add-a-passkey prompt

- After someone signs in by email link or Google, on a device that supports passkeys, if they
  have no passkeys: a small dialog "Sign in faster next time" with "Add a passkey" and "Not now".
- "Not now" is remembered on that device for 30 days (localStorage). Never shown again once they
  have a passkey.

### What's new

A What's new entry for the feature (repo convention for a new screen and action). Can be dropped
at review, as was done for #278.

## Constraints

- Australian English, sentence case, plain copy (`AGENTS.md`).
- Icons from `@/components/icons`, loading states with the shadcn `Spinner`, mutations through
  `useAction()`, errors as toasts.
- Tappable rows at least 44pt; check at 390px with touch emulation.
- Never edit a shipped migration; add a new one.

## Left to the builder

- Exact Better Auth hook used for the activity log entries.
- How the default passkey name is derived (user agent or AAGUID lookup).
- Component structure inside the login page and profile section.
- Tests: unit tests for any helpers (support detection, nudge timing), and an integration test that
  the `passkey` table migration applies and cascades on user delete.

## Calls made by Claude, for review

- Passkey button first on the login page, plus autofill on the email field.
- An add-a-passkey prompt after other sign-ins, dismissed for 30 days per device.
- "Production only" means the deployed build on the `BETTER_AUTH_URL` origin (user asked for
  production only; how it is detected is Claude's call).
- No Settings switch to turn passkeys off, and no admin view of other people's passkeys.
- Adding and removing passkeys go in the activity log.
- A What's new entry is included unless you say otherwise.

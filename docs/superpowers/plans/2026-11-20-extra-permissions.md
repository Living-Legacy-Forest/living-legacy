# Extra Permissions Per Person Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin can give one person specific permissions on top of their role, from the Users screen or when inviting them.

**Architecture:** A JSON `extra_permissions` column on `user` and `invitation`. `can()` takes `{ role, extraPermissions }` and returns role grants ∪ extras. The session user carries the parsed extras, so no extra query per request. Roles that cannot be expressed as a role list (SQL "who can publish" lookups) get one SQL helper.

**Tech Stack:** Bun monorepo, Drizzle on D1, Better Auth, TanStack Start, Zod, Vitest (unit + Miniflare integration).

**Spec:** [docs/superpowers/specs/2026-11-20-extra-permissions-design.md](../specs/2026-11-20-extra-permissions-design.md)

## Global Constraints

- `users:manage` is never grantable as an extra; everything else in `permissions` is.
- Add only. No taking permissions away from a role.
- Only people with `users:manage` can change extras; each change is logged with `logActivity`.
- Never edit a shipped migration; add a new one (`bun run --filter @ll/db generate -- --name extra-permissions`).
- Never import `@ll/db` values or the whole schema into a component.
- Form validation errors are Sonner toasts on submit, never inline. Mutations use `useAction()`. Loading uses the shadcn `Spinner`. Icons come from `@/components/icons`.
- User-facing copy: plain, sentence case, Australian English.
- Commits follow Conventional Commits, header at most 100 characters, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- A new extra reaches an already-signed-in person within 5 minutes (session cookie cache). Accepted; no workaround.
- A change editors would notice gets an entry at the top of `apps/cms/src/lib/whats-new.ts`.

## Review Focus

Failure modes the spec implies but a straight reading would not test, most likely first:

1. Stored `extra_permissions` is malformed JSON, not an array, or holds `users:manage` or an unknown name: ignored, nothing throws, access never widens. (Task 1)
2. Anyone who can publish (the review recipient list, the reviewer picker, "request review" validation) includes a user whose only route to `posts:publish` is an extra, and excludes one who has neither. (Task 3)
3. An invited person's extras are on their user row after first sign-in; a bootstrap admin and an uninvited stranger are unaffected. (Task 3)
4. An author with `redirects:write` as an extra sees Redirects in the sidebar and phone nav, and passes the route guard. (Task 4)
5. An API key held by someone with `posts:write` only as an extra can write; one held by a viewer with no extras cannot. (Task 4)

---

### Task 1: Shared access rules

**Files:**

- Modify: `packages/content/src/roles.ts`
- Test: `packages/content/src/roles.test.ts`

**Interfaces:**

- Produces (all exported from `@ll/content`):
  - `type Access = { role: Role; extraPermissions?: readonly Permission[] }`
  - `grantablePermissions: readonly Permission[]`: every permission except `users:manage`
  - `parseExtraPermissions(stored: unknown): Permission[]`: accepts a JSON string, an array, null or anything else; never throws; drops unknown, non-grantable and duplicate names
  - `extraPermissionsSchema: z.ZodType<Permission[]>`: for input; rejects `users:manage` and unknown names with a readable message, de-duplicates
  - `toAccess(row: { role: string; extraPermissions?: string | null }): Access`: unknown role falls back to `'viewer'`; extras go through `parseExtraPermissions`
  - `can(access: Access | Role, permission: Permission): boolean`. The bare-`Role` form stays for now and is marked `@deprecated`; Task 4 removes it.
  - `rolesGranting(permission: Permission): Role[]`
  - `permissionsFor(access: Access): Permission[]`

- [ ] **Step 1: Write failing tests in `roles.test.ts`.** Add cases for: author + `['redirects:write']` can `redirects:write` and still cannot `settings:write`; viewer + extras `['posts:write']` can write posts; `can('author', 'redirects:write')` (bare role) is still false; `parseExtraPermissions` returns `[]` for `'not json'`, `'{"a":1}'`, `null`, `undefined`, `42`; returns `['redirects:write']` for `'["redirects:write","redirects:write"]'`; drops `'users:manage'` and `'bogus:thing'` from `'["users:manage","bogus:thing","seo:write"]'` leaving `['seo:write']`; `extraPermissionsSchema.safeParse(['users:manage']).success` is false; `toAccess({ role: 'wizard', extraPermissions: '["seo:write"]' })` gives role `viewer`; `rolesGranting('posts:publish')` equals `['admin', 'editor']`; `permissionsFor` for author + `['redirects:write']` contains `posts:write`, `media:write`, `redirects:write` once each. Also assert `grantablePermissions` excludes `users:manage` and includes every other permission.
- [ ] **Step 2: Run** `bun run --filter @ll/content test -- roles` and confirm the new cases fail.
- [ ] **Step 3: Implement** the interfaces above in `roles.ts`. Keep `grants` as the role map; `can` unions it with `access.extraPermissions` when given an object. Extras are re-filtered through `grantablePermissions` inside `can` too, so a hand-built `Access` cannot grant `users:manage`.
- [ ] **Step 4: Run** `bun run --filter @ll/content test && bun run --filter @ll/content type-check`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(content): extra permissions on top of a role`

---

### Task 2: Database column and test fixtures

**Files:**

- Modify: `packages/db/src/schema/auth.ts` (both `user` and `invitation`)
- Create: `packages/db/migrations/0040_extra-permissions.sql` (+ snapshot and journal entry, generated)
- Modify: `apps/cms/test/fixtures.ts`

**Interfaces:**

- Produces: `user.extraPermissions` and `invitation.extraPermissions`: `text('extra_permissions').notNull().default('[]')`, comment: JSON array of permission names; read through `parseExtraPermissions`, never directly.
- Produces: `addUser(role?: Role, name?: string, extraPermissions?: Permission[]): Promise<string>` in `fixtures.ts`; stores `JSON.stringify(extraPermissions ?? [])`.

- [ ] **Step 1: Edit the schema** in `auth.ts` to add the column to both tables.
- [ ] **Step 2: Generate** `bun run --filter @ll/db generate -- --name extra-permissions`. Check the SQL is two `ALTER TABLE … ADD extra_permissions text DEFAULT '[]' NOT NULL` statements and nothing else.
- [ ] **Step 3: Apply locally** `bun run --filter @ll/cms db:migrate:local`. Expected: migration applied, no error.
- [ ] **Step 4: Extend `addUser`** with the third parameter.
- [ ] **Step 5: Run** `bun run type-check`. Expected: pass (nothing else uses the column yet).
- [ ] **Step 6: Commit** `feat(db): extra_permissions on users and invitations`

---

### Task 3: Session, sign-up and the SQL publisher lookup

**Files:**

- Modify: `apps/cms/src/lib/auth.ts` (`additionalFields`; user-create `before` hook)
- Modify: `apps/cms/src/lib/session.ts` (`SessionUser`, `loadUser`, `requirePermission`)
- Create: `apps/cms/src/server/access-sql.ts`
- Modify: `apps/cms/src/server/posts.ts` (the three `inArray(user.role, publishRoles())` uses and the reviewer check)
- Test: `apps/cms/src/server/access-sql.integration.test.ts`

**Interfaces:**

- Consumes: Task 1 `parseExtraPermissions`, `rolesGranting`, `grantablePermissions`, `can`; Task 2 column and `addUser`.
- Produces: `SessionUser.extraPermissions: Permission[]`.
- Produces: `hasPermissionSql(permission: Permission): SQL`, in `access-sql.ts`: true for rows of `user` whose role grants it, or (when the permission is grantable) whose `extra_permissions` JSON array contains it. Use `inArray(user.role, rolesGranting(permission))` OR `EXISTS (SELECT 1 FROM json_each(user.extra_permissions) WHERE value = ?)`. Wrap `json_each` so malformed JSON in a row cannot fail the whole query (`json_valid(...)` guard).

- [ ] **Step 1: Write failing integration tests** in `access-sql.integration.test.ts` (clear `user` in `beforeEach`): create editor, author, author + `['posts:publish']`, viewer, and an author whose `extra_permissions` is the literal string `not json` (insert it directly). `select id from user where hasPermissionSql('posts:publish')` returns exactly the editor, the author-with-extra, and any admin created; not the plain author, viewer or malformed-JSON user. A second case: `hasPermissionSql('users:manage')` returns admins only, even for a user whose JSON holds `["users:manage"]` (insert directly).
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:integration -- access-sql`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `hasPermissionSql` as above.
- [ ] **Step 4: Replace `publishRoles()`** in `posts.ts` with `hasPermissionSql('posts:publish')` at its three `.where(...)` sites (combine with `and(..., ne(...))` where one already exists at line ~490). In `requestReview`, validate the chosen reviewer with `can(toAccess(reviewer), 'posts:publish')`. Delete `publishRoles` and the unused `roles` import.
- [ ] **Step 5: Session.** Add `extraPermissions: { type: 'string', required: false, defaultValue: '[]', input: false }` to `additionalFields`. `loadUser` returns `extraPermissions: parseExtraPermissions(session.user.extraPermissions)`. `requirePermission` calls `can(context.user, permission)`.
- [ ] **Step 6: Sign-up.** In the user-create `before` hook, return `extraPermissions: JSON.stringify(parseExtraPermissions(invite?.extraPermissions))` alongside `role`. A bootstrap admin gets `'[]'` when they have no invitation. Do not change `resolveSignupRole`.
- [ ] **Step 7: Run** `bun run --filter @ll/cms test && bun run type-check`. Expected: pass. (`SessionUser` still has `role`, so unmigrated `can(user.role, …)` calls still compile; Task 4 sweeps them.)
- [ ] **Step 8: Commit** `feat(cms): carry extra permissions in the session and publisher lookups`

---

### Task 4: Sweep every access check onto the person

**Files:** every file `grep -rn "can(" apps/cms/src` lists, plus the ones below. Do not leave a `can(<role>, …)` call.

**Interfaces:**

- Consumes: Task 1 `can`, `toAccess`; Task 3 `SessionUser.extraPermissions`.
- Produces (changed signatures):
  - `isNavItemAllowed(item: NavItem, access: Access)` and `sidebarSections(access: Access)` in `lib/nav.ts`
  - `canSuggest(access: Access)` in `server/ai/client.ts`; `assistantStatusFor(db: Db, access: Access)` in `server/ai/status.ts`; `Actor = { id: string } & Access` in `server/ai/suggest.ts`
  - `ApiActor` in `lib/api-keys.ts` carries `extraPermissions: Permission[]`; `canWrite(actor: { scope: ApiKeyScope } & Access)`
  - `postAccessFor(user: { id: string } & Access, createdBy, scheduled?)`

Pattern: a call that has a `SessionUser` passes the user (`can(context.user, p)`, `can(user, p)`). Where a function only destructured `role` (`notifications.ts`, `dashboard.ts`, `content-checks.ts`, `checks/index.tsx`), pass the whole user instead. The places that read `session.user.role as Role` straight from Better Auth (`routes/api/media`, `media-cover/$id`, `media-versions/$id`, `avatar`) use `can(toAccess(session.user), p)`. `authenticateApiRequest` selects `user.extraPermissions` and builds the actor with `toAccess`. `server/mcp.ts` uses `canWrite`; confirm it needs no other change. Also `server/dashboard.ts` has a `loadAttention(db, user: { id; role }, …)`: widen to `{ id } & Access`.

- [ ] **Step 1: Write failing tests.** In `lib/nav.test.ts` (create if absent; unit): `isNavItemAllowed` for the Redirects item is false for `{ role: 'author' }` and true for `{ role: 'author', extraPermissions: ['redirects:write'] }`; `sidebarSections({ role: 'author', extraPermissions: ['redirects:write'] })` contains a page linking to `/redirects`. In `lib/api-keys.test.ts` (extend or create; unit): `canWrite({ scope: 'write', role: 'viewer', extraPermissions: ['posts:write'] })` is true; `canWrite({ scope: 'write', role: 'viewer' })` is false; `canWrite({ scope: 'read', role: 'admin' })` is false. In the existing post-access test (or a new `post-access.test.ts`): a viewer with `['posts:publish']` gets `'full'`; an author with `['seo:write']` and someone else's post gets `'seo'`.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:unit` and confirm the new cases fail.
- [ ] **Step 3: Migrate the call sites** as described. Work from `bun run type-check` output after Step 4 if you miss any.
- [ ] **Step 4: Tighten `can`.** In `roles.ts`, remove the bare-`Role` form and its `@deprecated` note so `can` takes only `Access`. Update the existing role-only tests in `roles.test.ts` to `can({ role: 'admin' }, …)`.
- [ ] **Step 5: Run** `bun run type-check && bun run lint && bun run test`. Expected: all pass. A remaining `can('role', …)` shows up as a type error; fix, don't cast.
- [ ] **Step 6: Run** `bunx prettier --write` on the touched files, then re-run Step 5.
- [ ] **Step 7: Commit** `refactor(cms): check access by person, not role alone`

---

### Task 5: Server functions for editing extras

**Files:**

- Modify: `apps/cms/src/server/users.ts` (`listUsers`, `inviteUser`, new `setExtraPermissions`)
- Test: `apps/cms/src/server/users.integration.test.ts` (create; the handler logic goes in an exported helper so it can be tested without a request, matching how other server files split store and handler)

**Interfaces:**

- Consumes: Task 1 `extraPermissionsSchema`, `parseExtraPermissions`; Task 2 columns, `addUser`.
- Produces:
  - `setExtraPermissions` server fn: `POST`, `requirePermission('users:manage')`, validator `z.object({ userId: z.string(), extraPermissions: extraPermissionsSchema })`. Updates `user.extraPermissions`; throws `'That user no longer exists.'` for a missing id; logs `action: 'user.permissions_changed'`, `summary: "Changed <name>'s extra access from <before> to <after>"` (comma-separated names, `none` when empty).
  - `inviteUser` validator gains `extraPermissions: extraPermissionsSchema.default([])`; writes it on insert and on the conflict update; the activity summary adds `with extra access to <names>` when non-empty.
  - `listUsers` returns `extraPermissions: Permission[]` (via `parseExtraPermissions`) on each user and each invitation.

- [ ] **Step 1: Write failing integration tests.** With a fresh DB per file: (a) setting `['redirects:write']` on an author stores `["redirects:write"]` and writes one activity-log row naming before and after; (b) setting `[]` clears it; (c) a missing user id throws the readable message; (d) re-inviting the same email replaces extras rather than merging; (e) `listUsers` returns extras as an array for a user whose stored value is malformed JSON, as `[]`. Test (a)–(d) against the exported store helpers; (e) through `listUsers`' mapping helper.
- [ ] **Step 2: Run** `bun run --filter @ll/cms test:integration -- users` and confirm failure.
- [ ] **Step 3: Implement** the three changes. Do not touch `changeUserRole` (a role change keeps extras).
- [ ] **Step 4: Run** `bun run --filter @ll/cms test && bun run type-check`. Expected: pass.
- [ ] **Step 5: Commit** `feat(cms): save extra permissions for a person or an invitation`

---

### Task 6: Users screen

**Files:**

- Modify: `apps/cms/src/components/users/users-page.tsx`
- Create: `apps/cms/src/components/users/extra-access.tsx` (the checklist, used by both the person's pane and the invite form)

**Interfaces:**

- Consumes: Task 5 `setExtraPermissions`, `inviteUser`, `listUsers` shape; Task 1 `grantablePermissions`, `can`, `Role`.
- Produces: `<ExtraAccess role={Role} value={Permission[]} onChange={(next: Permission[]) => void} disabled?={boolean} />`. One checkbox per grantable permission, grouped under the headings the comments in `roles.ts` imply (Posts, SEO, Content, Events, Media, Other). Permissions the role already includes are ticked, locked and labelled `Included in <role>`; they are never in `value`. Each label is a plain-language sentence taken from the comment beside the permission in `roles.ts` (for example "Edit redirects"). `users:manage` is not shown.

- [ ] **Step 1: Write a failing component-free unit test** for the pure helper the component uses, `splitExtras(role, selected)` → `{ included: Permission[]; extras: Permission[] }`, in `extra-access.test.ts` (author + `['posts:write', 'redirects:write']` gives included `['posts:write']`, extras `['redirects:write']`; admin has no extras). Run `bun run --filter @ll/cms test:unit -- extra-access`; expect FAIL.
- [ ] **Step 2: Implement** `splitExtras` and the `ExtraAccess` component in `extra-access.tsx`. Checkboxes are the existing shadcn checkbox primitive; rows are at least `touch:min-h-11`.
- [ ] **Step 3: Person pane.** Below the role control, show `ExtraAccess` for the selected user. Saving calls `setExtraPermissions` through `useAction()`. Your own row is read-only (an admin has everything anyway). Admin rows show "Admins can do everything" instead of the checklist.
- [ ] **Step 4: Invite form.** Add the same checklist under the role picker, resetting when the role changes. Pass the extras to `inviteUser`. Pending invitations list their extras as a short line.
- [ ] **Step 5: Run** `bun run type-check && bun run lint && bun run --filter @ll/cms test:unit`. Expected: pass.
- [ ] **Step 6: Check in the browser** with `bun run dev:cms`: tick `redirects:write` on an author, sign in as that author (use the test email from memory), confirm Redirects appears in the sidebar within five minutes and the page loads; at 390px with touch emulation, confirm rows are tappable and nothing overflows. State plainly in the report if you could not run it.
- [ ] **Step 7: Commit** `feat(cms): choose extra access for a person on the Users screen`

---

### Task 7: What's new and full check

**Files:**

- Modify: `apps/cms/src/lib/whats-new.ts` (add `'/users'` to the link `to` union if absent; add one entry at the top)

- [ ] **Step 1: Add the entry** dated 2026-11-20: title "Extra access for one person", body in plain sentences saying an admin can give someone a single extra permission, such as managing redirects, without changing their role, linking to Users with label "Open Users".
- [ ] **Step 2: Run** `bun run type-check && bun run lint && bun run format:check && bun run test && bun run build`. Expected: all pass.
- [ ] **Step 3: Commit** `docs(cms): announce extra access in What's new`

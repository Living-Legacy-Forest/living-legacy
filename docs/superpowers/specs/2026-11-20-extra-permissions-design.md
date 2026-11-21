# Extra permissions per person: design

## Intent

Access is decided only by role today. An admin who wants an author to manage redirects has to
make them an admin. This lets an admin add specific permissions to one person on top of their
role, without changing the role.

## Goals

- An admin can tick extra permissions for any user, and set them when inviting.
- Effective access = the role's permissions + the person's extras.
- Every check (server middleware, route guards, UI controls) honours extras.
- Changes show in the activity log.

## Non-goals

- Taking permissions away from a role. To reduce access, change the role.
- Custom roles, a roles table or a permission editor.
- Per-record permissions (e.g. one specific post).

## Anti-goals

- A person being able to grant themselves or anyone else admin-level control.
- Hiding the reason someone can do something: the Users screen must show role vs extra.

## Approaches considered

1. **JSON list of extras on `user` (chosen).** No extra query: the session already loads the
   user row. Small change, keeps the five roles.
2. One row per grant in a table. Records who/when, but costs a query per request or extra Better
   Auth wiring; the activity log already records who/when.
3. Custom roles. Most flexible, much bigger, and breeds near-identical roles.

## Design

**Data.** `user.extra_permissions` and `invitation.extra_permissions`: text, JSON array of
permission names, not null, default `'[]'`. New migration; no shipped migration is edited.
Invitations carry extras so they apply on first sign-in.

**Shared rules (`@ll/content`).**
- `grantablePermissions`: every permission except `users:manage`.
- `can(access, permission)` takes `{ role, extraPermissions }` instead of a role. Effective
  permissions are the role's grants plus extras. Unknown or non-grantable names in stored extras
  are ignored, so bad data can never widen access.
- `extraPermissionsSchema` (Zod) validates and de-duplicates, rejecting `users:manage`.
- Unit tests cover union, the `users:manage` exclusion, and bad stored data.

**Session.** Better Auth `additionalFields` gains `extraPermissions` (string, `input: false` so
a person cannot set their own). `SessionUser` carries `extraPermissions: Permission[]`, parsed
defensively. `requirePermission` and all ~80 `can(...)` call sites pass the user, not `user.role`.
`postAccessFor` takes the same shape, so an author with `posts:publish` as an extra counts as
an editor on posts (my call, follows how it already branches).

**Server (`users.ts`).** New `setExtraPermissions` (requires `users:manage`, validated, logs
activity with before/after). `inviteUser` accepts extras. A role change keeps extras. Extras on
an admin are stored but have no effect.

**UI (`users-page.tsx`).** In the person's pane and the invite form, a checklist of permissions
with plain-language labels. Ones the role already includes are ticked and locked, labelled "Included
in <role>". `users:manage` is not shown. Validation errors are toasts, per the project's rule.
Saving uses `useAction()`.

**What's new.** One entry at the top of `lib/whats-new.ts`, linking to the Team/Users screen.

## Constraints

- **Delay.** The session cookie cache is 5 minutes, so a new extra (or its removal) reaches an
  open session within 5 minutes. Same as role changes today. Not worth a workaround.
- Never import `@ll/db` values into components.
- Tests: unit tests in `@ll/content`; an integration test that a user with an extra passes
  `requirePermission` and one without is refused.

## Decided by the author of this doc (not discussed)

- `users:manage` is never grantable (privilege escalation).
- Only admins edit extras.
- Admin-only `content:replace` and `content:purge` are grantable; they are the admin's choice.

## Left to the builder

- Exact checklist labels and grouping (follow the comments in `roles.ts`).
- Migration name; how to split the call-site update into commits.
- The API-key and MCP paths (`api-keys.ts`, `mcp.ts`): check whether they derive permissions from
  a role and apply the same union if so.

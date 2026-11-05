# Working in this repo

A Bun monorepo: a public website and the CMS that edits its content, both on Cloudflare Workers
and sharing one D1 database. Setup and environment variables are in [`README.md`](README.md);
the website stack is in [`TECH_SPEC.md`](TECH_SPEC.md).

| Path               | What it is                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| `apps/web`         | Website. Astro, server-rendered per request, reads the CMS's database.       |
| `apps/cms`         | CMS. TanStack Start + Router, shadcn on Base UI, Tailwind 4.                 |
| `packages/db`      | Drizzle schema (`src/schema/`), enums, D1 migrations (`migrations/`).        |
| `packages/content` | Rules both apps share: roles and permissions, Zod schemas, slugs, rich text. |

## Commands

Run from the repo root.

```sh
bun run dev:cms                                   # CMS on :3100
bun run dev:web                                   # website on :4321
bun run type-check && bun run lint && bun run format:check && bun run test && bun run build   # what CI runs
bunx prettier --write <paths>                     # format what you touched
```

Database changes: edit `packages/db/src/schema/`, then
`bun run --filter @ll/db generate -- --name <what-changed>` and
`bun run --filter @ll/cms db:migrate:local`. Never edit a migration that has shipped; add a new one.

## Conventions

- **Commits** follow Conventional Commits (`feat(cms): …`, `fix(web): …`), header at most 100
  characters. commitlint enforces it in a hook and in CI.
- **Branches** come off `master`; PRs target `master`.
- **Comments** say why, not what. Match the density of the file you're in.
- **User-facing copy** is plain, sentence case, in Australian English ("organise", "colour").

## CMS (`apps/cms/src`)

| Folder             | What goes there                                                                 |
| ------------------ | ------------------------------------------------------------------------------- |
| `routes/`          | File routes. A route loads data and renders one page component; keep logic out. |
| `server/`          | Server functions, one file per area (`team.ts`, `faqs.ts`, …).                  |
| `components/`      | One folder per area (`team/`, `faqs/`, …), plus the shared folders below.       |
| `components/ui`    | shadcn primitives. Edit sparingly, so they stay close to upstream.              |
| `components/list`  | The list-page building blocks (see below).                                      |
| `components/shell` | Sidebar, header, phone tab bar, command menu.                                   |
| `lib/`             | Client and shared helpers (`use-action`, `format`, `session`, `db`).            |

### Server functions

```ts
export const saveTerm = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:write')]) // or authMiddleware for reads
  .validator(saveSchema) // Zod; shared schemas live in @ll/content
  .handler(async ({ data }) => { const db = getDb(); … });
```

- Import tables by name from `@ll/db/schema` and enums from `@ll/db/enums`. Never import the
  whole schema or `@ll/db` values into a component: that ships Drizzle to the browser.
- Permissions come from `can(role, permission)` in `@ll/content`. Check them on the server
  (middleware) and use them on the client only to hide controls.
- Writes that should appear in the activity log batch `logActivity(db, entry)` with the write.
- Throw `Error` with a sentence the user can read; the client shows it as a toast.

### Pages and components

- Mutations go through `useAction()` (`lib/use-action.ts`): pending flag, toast and loader
  refresh in one call.
- Import icons from `@/components/icons`, never from an icon package directly.
- Loading states use the shadcn `Spinner` (`components/ui/spinner`).
- The page heading is `<h1 data-slot="page-title">`; on phones it becomes the large title.

### List pages

Team, FAQs, redirects, testimonials, media coverage, announcements, terms and posts share
`components/list/`. A new list page should too:

- `useListPane<Target>()` holds what is open. On `lg` and up it shows in the right-hand pane;
  smaller screens open the same target in `ListDialog`.
- `ListPageLayout` → `ListColumn` (with a `SelectionBar` header) + `PaneColumn`.
- Each row is a `ListRow`: tick box, Edit-mode `actions`, `trailing`, and `swipe` to delete.
- `useSelection(ids)` drives ticks and Edit mode; bulk and swipe deletes both go through one
  `toDelete: string[] | null` state and `ConfirmBulkDelete`.

[`terms-page.tsx`](apps/cms/src/components/terms/terms-page.tsx) is the smallest example.

### Phones and touch

- `touch:` (`@media (hover: none)`) is for anything hover reveals on desktop. Touch screens
  need another way in: Edit mode, a swipe, or showing it outright.
- Tappable rows are at least 44pt (`touch:min-h-11`).
- Check changes at 390px with touch emulation as well as on desktop.

### Rich-text editor

`components/editor`, `components/extensions`, `components/templates` and
`components/static-renderer` came from an editor registry. ESLint skips the first two. Expect
this area to be reorganised; don't copy its patterns elsewhere.

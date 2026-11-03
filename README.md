# Living Legacy

Monorepo for livinglegacy.com.au and its content management system.

| Path               | What it is                                                           |
| ------------------ | -------------------------------------------------------------------- |
| `apps/web`         | Public website. Astro on Cloudflare Workers, content from the CMS.   |
| `apps/cms`         | Custom CMS admin. TanStack Start + shadcn/ui on Cloudflare Workers.  |
| `packages/db`      | Drizzle schema, D1 migrations and typed queries shared by both apps. |
| `packages/content` | Shared content rules: roles, permissions, Zod schemas.               |

Design: [`docs/superpowers/specs/2026-10-28-cms-design.md`](docs/superpowers/specs/2026-10-28-cms-design.md).
Website stack details: [`TECH_SPEC.md`](TECH_SPEC.md).

## Setup

Requires Bun (version pinned in `package.json` → `packageManager`) and Node (`.node-version`),
because Astro and ESLint run under Node.

```sh
bun install
```

### Website

```sh
cp apps/web/.env.example apps/web/.env
bun run dev:web            # http://localhost:4321
```

### CMS

```sh
cp apps/cms/.dev.vars.example apps/cms/.dev.vars   # fill in the values
bun run --filter @ll/cms db:migrate:local
bun run dev:cms            # http://localhost:3100
```

Sign-in is Google only and invite-only. Put your own email in `BOOTSTRAP_ADMIN_EMAILS` to get
in as the first Admin.

## Database changes

1. Edit the schema in `packages/db/src/schema/`.
2. `bun run --filter @ll/db generate -- --name <what-changed>` writes a migration to
   `packages/db/migrations/`.
3. `bun run --filter @ll/cms db:migrate:local` applies it locally.
4. After `wrangler.jsonc` binding changes, run `bun run --filter @ll/cms cf-typegen`.

## Checks (same as CI)

```sh
bun run type-check && bun run lint && bun run format:check && bun run test && bun run build
```

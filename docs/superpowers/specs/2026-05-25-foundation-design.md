# Foundation Design — Living Legacy Forest

**Date:** 2026-05-25
**Site:** https://livinglegacyforest.com.au
**Project:** living-legacy
**Maintainer:** Sister Creatives

---

## 1. Overview

A fresh Astro project scaffolded via `pnpm create astro@latest`, then layered with the same tech stack as mornington-green. The two sites share the same technology stack but are independent codebases — living-legacy is not a clone.

| | |
|---|---|
| **Framework** | Astro 5.x |
| **Adapter** | `@astrojs/cloudflare` (Cloudflare Pages) |
| **Node** | `22.12.0` (pinned via `.node-version`) |
| **Package manager** | `pnpm` |
| **Default branch** | `master` |
| **Staging branch** | `preview` |

---

## 2. Stack

| Layer | Technology |
|---|---|
| Framework | Astro 5.x |
| Adapter | `@astrojs/cloudflare` |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4.x (Vite plugin) |
| CMS | Sanity (`@sanity/astro` + `@sanity/client`) |
| Asset CDN | Cloudinary (upload tooling) |
| Hosting | Cloudflare Pages (Workers runtime) |
| Error monitoring | Sentry (`@sentry/astro` + `@sentry/cloudflare`) |
| Animation | Motion One (`motion`) |
| Icons | `lucide-astro` |
| Rich text | `@portabletext/to-html` |

---

## 3. Directory Structure

```
living-legacy/
  .github/
    workflows/
      ci.yml                  ← build + type-check + commitlint + gitleaks
      scheduled-rebuild.yml   ← hourly Cloudflare deploy hook trigger
    dependabot.yml            ← weekly grouped dependency updates
  .husky/
    commit-msg                ← commitlint hook
  public/
    _redirects                ← Cloudflare Pages redirects stub
  scripts/
    generate-redirects.mjs    ← stub (populate as needed)
  src/
    components/
      sections/
        shared/               ← reusable section building blocks
      ui/                     ← atoms (buttons, cards, etc.)
      forms/                  ← form primitives
      layout/                 ← header, footer, nav
    layouts/
      BaseLayout.astro        ← <head>, header, footer, theme bootstrap
    lib/
      sanity.ts               ← Sanity client config
    pages/
      index.astro             ← placeholder home page
      api/
        sanity-webhook.ts     ← triggers Cloudflare deploy hook on Sanity publish
    styles/
      global.css              ← Tailwind entry point (@import "tailwindcss")
    types/                    ← shared TypeScript types
    sanity/
      schemaTypes/            ← empty, ready for schema definitions
  docs/
    superpowers/
      specs/                  ← design specs
  .coderabbit.yaml
  .env.example
  .gitleaks.toml
  .node-version               ← 22.12.0
  .prettierignore
  .prettierrc
  astro.config.mjs
  biome.json
  commitlint.config.cjs
  package.json
  sanity.cli.ts
  sanity.config.ts
  sentry.client.config.js
  sentry.server.config.js
  tsconfig.json
  wrangler.jsonc
  TECH_SPEC.md
```

---

## 4. Rendering Strategy

- **Static by default** — all pages pre-rendered at build time.
- **SSR opt-in** — `/api/*` routes use Cloudflare Workers runtime.
- **Prefetch on hover** — `prefetchAll: false`, `defaultStrategy: 'hover'`.
- **Image service** — `imageService: 'compile'` via Cloudflare adapter.

---

## 5. Services

### Sanity CMS
- New Sanity project (separate from mornington-green).
- Dataset: `production`.
- Hosted studio: `living-legacy.sanity.studio`.
- Embedded studio bundled with the site app.
- Webhook at `/api/sanity-webhook` triggers Cloudflare deploy hook on content publish.
- No schemas scaffolded — config wired, schemas defined when content model is known.

### Cloudinary
- Existing Sister Creatives account.
- Upload script (`scripts/upload-to-cloudinary.mjs`) stubbed and ready.
- Env vars templated in `.env.example`.

### Sentry
- New project `living-legacy` under org `sister-creatives`.
- `sentry.client.config.js` + `sentry.server.config.js` wired.
- Source maps uploaded only during production builds (`NODE_ENV === 'production'`).

### HubSpot
- `PUBLIC_HUBSPOT_PORTAL_ID` env var templated (same portal as mornington-green unless updated).

### Google Analytics
- `PUBLIC_GA_MEASUREMENT_ID` env var templated (optional, GA4).

---

## 6. Environment Variables

All vars defined in `.env.example` and validated via Astro's `env.schema` in `astro.config.mjs`.

| Variable | Context | Access | Notes |
|---|---|---|---|
| `PUBLIC_HUBSPOT_PORTAL_ID` | client | public | HubSpot embed |
| `PUBLIC_GA_MEASUREMENT_ID` | client | public | GA4, optional |
| `PUBLIC_CLOUDINARY_CLOUD_NAME` | client | public | Cloudinary URL builder |
| `PUBLIC_SANITY_PROJECT_ID` | client | public | Used by generate-redirects script |
| `PUBLIC_SANITY_DATASET` | client | public | Default: `production` |
| `PUBLIC_SITE_ENV` | client | public | `development` / `staging` / `production` |
| `SANITY_PROJECT_ID` | server | secret | |
| `SANITY_DATASET` | server | secret | Default: `production` |
| `SANITY_API_VERSION` | server | secret | e.g. `2026-05-25` |
| `CLOUDINARY_API_KEY` | server | secret | |
| `CLOUDINARY_API_SECRET` | server | secret | |
| `CLOUDINARY_CLOUD_NAME` | server | secret | |
| `EVENTBRITE_API_KEY` | server | secret | Optional |
| `EVENTBRITE_ORG_ID` | server | secret | Optional |
| `CLOUDFLARE_DEPLOY_HOOK` | server | secret | Used by sanity webhook + scheduled rebuild |
| `SANITY_WEBHOOK_SECRET` | server | secret | Optional |
| `SENTRY_AUTH_TOKEN` | server | secret | Build-time only, source map upload |

---

## 7. Workflow & CI/CD

### Husky
- `commit-msg`: runs `npx --no -- commitlint --edit "$1"`

### Commitlint (`commitlint.config.cjs`)
- Extends `@commitlint/config-conventional`
- Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`, `build`, `ci`, `revert`
- Subject case: no upper/pascal/start-case
- Header max length: 100

### GitHub Actions

**`ci.yml`** — triggers on push to `master` and `workflow_dispatch`:
1. Checkout (full history)
2. Gitleaks secret scan
3. Setup pnpm + Node (from `.node-version`)
4. `pnpm install --frozen-lockfile`
5. `pnpm audit --audit-level=critical`
6. `pnpm type-check`
7. `pnpm build`
8. Commitlint via `wagoid/commitlint-github-action@v6`

**`scheduled-rebuild.yml`** — hourly cron, POSTs to `CLOUDFLARE_DEPLOY_HOOK` (keeps static pages fresh with Sanity content changes).

**`dependabot.yml`** — weekly on Mondays at 09:00 Melbourne time:
- Groups: `astro-ecosystem`, `sanity`, `tailwind`, `lucide`
- Blocks major version auto-bumps for `astro`, `sanity`, `tailwindcss`
- Also covers GitHub Actions dependencies

### CodeRabbit (`.coderabbit.yaml`)
- Auto-review on non-draft PRs
- Skips: `pnpm-lock.yaml`, `dist/**`, `.cloudflare/**`, `.claude/**`, `docs/**`, `public/**`, `**/*.md`

### Gitleaks (`.gitleaks.toml`)
- Allowlist populated with known public identifiers once Sanity project ID, HubSpot portal ID, and Cloudinary cloud name are known.

---

## 8. Code Quality

| Tool | Config |
|---|---|
| TypeScript | `astro/tsconfigs/strict`, `@/*` → `src/*`, `strictNullChecks`, `noUncheckedIndexedAccess` |
| Prettier | `singleQuote`, `semi`, `tabWidth: 2`, `trailingComma: es5`, `printWidth: 100`, plugins: astro + tailwindcss |
| ESLint | `@typescript-eslint`, `eslint-plugin-astro`, `eslint-plugin-jsx-a11y` |
| Biome | Disabled (formatter + linter off, present for future opt-in) |

---

## 9. Deployment

- **Hosting:** Cloudflare Pages
- **Build command:** `pnpm build`
- **Build output:** `dist/`
- **Wrangler config:** `name: "living-legacy"`, `compatibility_date: "2026-05-25"`
- **Sanity studio:** deployed separately via `pnpm studio:deploy` → `living-legacy.sanity.studio`

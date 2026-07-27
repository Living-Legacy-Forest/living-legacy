# Tech Specification — Living Legacy Forest

A reference for the technical stack, third-party services, conventions, and build/deploy pipeline behind livinglegacyforest.com.au.

---

## 1. Overview

|                     |                                               |
| ------------------- | --------------------------------------------- |
| **Site**            | https://livinglegacyforest.com.au             |
| **Repo**            | github.com/Living-Legacy-Forest/living-legacy |
| **Default branch**  | `master`                                      |
| **Staging branch**  | `preview`                                     |
| **Maintainer**      | Sister Creatives                              |
| **Node**            | `>=22.12.0` (pinned via `.node-version`)      |
| **Package manager** | `pnpm`                                        |

---

## 2. Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Framework | Astro 7.x (`output: 'server'`)          |
| Adapter   | `@astrojs/cloudflare`                   |
| Language  | TypeScript (strict)                     |
| Styling   | Tailwind CSS 4.x (Vite plugin)          |
| CMS       | Sanity (studio + client)                |
| Asset CDN | Cloudinary (upload tooling)             |
| Hosting   | Cloudflare Workers (static assets)      |
| Animation | Motion One (`motion`)                   |
| Icons     | `lucide-astro`                          |
| Rich text | `@portabletext/to-html`                 |
| Analytics | PostHog (`posthog-js` + `posthog-node`) |

---

## 3. Architecture

- **Astro file-based routing.** Pages live under `src/pages/`, components under `src/components/`, content modules under `src/lib/`, types in `src/types/`.
- **Server-rendered on demand.** `output: 'server'` — every route renders per request on the Workers runtime, so published Sanity content appears immediately with no rebuild step. Nothing is pre-rendered.
- **Error reporting.** `src/middleware.ts` wraps on-demand rendering and reports failures to PostHog.
- **Single layout.** `src/layouts/BaseLayout.astro` provides `<head>`, canonical URL, robots meta, and the `noindex` prop.
- **Component organisation:** `src/components/sections/shared/` for reusable blocks; `src/components/ui/` for atoms; `src/components/forms/` for form primitives; `src/components/layout/` for header/footer.

---

## 4. Hosting & Deployment

### Cloudflare Workers

Astro 7's `@astrojs/cloudflare` v14 **dropped Cloudflare Pages support**, so the site deploys as a Worker with static assets. `dist/server/` is the Worker, `dist/client/` is served through the `ASSETS` binding.

- Adapter: `@astrojs/cloudflare` with `imageService: 'compile'`.
- Build command: `pnpm build`
- Build output: `dist/` (`server/` + `client/`)

### Wrangler config (`wrangler.jsonc`)

```jsonc
{
  "name": "living-legacy",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-05-25",
  "compatibility_flags": ["nodejs_compat"],
}
```

### Environment variables

Server vars are read through `astro:env/server`, which resolves from the **Workers runtime** rather than being inlined at build time. Set them as Worker vars/secrets; locally use `.dev.vars` (gitignored). Note that `PUBLIC_*` vars are the exception — they are inlined into the client bundle at build time and so require a rebuild to change.

### Branch & release workflow

- Feature branches off `master`.
- Each push gets a Cloudflare preview URL (Workers preview versions).
- PR target is `preview` for QA; `preview` → `master` once approved.
- Conventional Commits enforced via `commitlint`.

---

## 5. CMS — Sanity

- **Project ID**: _(set after Sanity project creation)_
- **Dataset**: `production`
- **API version**: `2026-05-25`
- **Hosted studio**: `living-legacy.sanity.studio`
- **Client config**: `src/lib/sanity.ts` — `getSanityClient()`, a lazily created request-time client with `useCdn: false`.

### Content freshness

There is no publish webhook and no scheduled rebuild. Pages render on demand and query Sanity directly with the CDN disabled, so published edits are live on the next request.

---

## 6. CI/CD

- **`ci.yml`**: gitleaks → install → audit → type-check → build → commitlint. Runs on push to `master`.
- **`dependabot.yml`**: weekly grouped dependency updates (astro, sanity, tailwind, lucide). Major version bumps require manual review.

---

## 7. Code Quality

| Tool       | Config                                                           |
| ---------- | ---------------------------------------------------------------- |
| TypeScript | `astro/tsconfigs/strict`, `@/*` → `src/*`                        |
| Prettier   | `singleQuote`, `semi`, `tabWidth: 2`, plugins: astro+tailwindcss |
| ESLint     | `@typescript-eslint`, `eslint-plugin-astro`, `jsx-a11y`          |
| commitlint | `@commitlint/config-conventional`, max header 100 chars          |
| Husky      | `commit-msg` hook                                                |
| CodeRabbit | Auto-review on non-draft PRs                                     |
| gitleaks   | Secret scanning in CI; allowlist for known public identifiers    |

---

## 8. Analytics & Error Tracking — PostHog

PostHog covers both product analytics and error tracking (it replaced Sentry).

| Surface | Package                     | File                                  |
| ------- | --------------------------- | ------------------------------------- |
| Browser | `posthog-js`                | `src/lib/analytics/posthog-client.ts` |
| Worker  | `posthog-node` (edge build) | `src/lib/analytics/posthog-server.ts` |

- `src/components/analytics/PostHog.astro` sits in `BaseLayout` `<head>` and dynamically imports the client module **only** when `PUBLIC_POSTHOG_KEY` is set, so unconfigured environments ship no analytics bundle.
- Client init uses `defaults: '2025-05-24'`, `capture_exceptions: true` (error tracking), and `person_profiles: 'identified_only'`. Session replay follows the PostHog project setting.
- Two browser errors are dropped before send: `ResizeObserver loop limit exceeded` and `Non-Error promise rejection captured`.
- SSR routes report handled failures via `captureServerException(error, props)`, which flushes per call because the Worker can be torn down as soon as the response returns.

### Environment

| Variable              | Context | Notes                                                             |
| --------------------- | ------- | ----------------------------------------------------------------- |
| `PUBLIC_POSTHOG_KEY`  | client  | Project API key (`phc_...`), write-only. Also read by the Worker. |
| `PUBLIC_POSTHOG_HOST` | client  | Defaults to `https://us.i.posthog.com`.                           |

Both are inlined at build time, so they must be set in Cloudflare Pages for **Production and Preview** before a build, not just at runtime.

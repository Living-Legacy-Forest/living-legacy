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

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Framework | Astro 5.x                          |
| Adapter   | `@astrojs/cloudflare`              |
| Language  | TypeScript (strict)                |
| Styling   | Tailwind CSS 4.x (Vite plugin)     |
| CMS       | Sanity (studio + client)           |
| Asset CDN | Cloudinary (upload tooling)        |
| Hosting   | Cloudflare Pages (Workers runtime) |
| Animation | Motion One (`motion`)              |
| Icons     | `lucide-astro`                     |
| Rich text | `@portabletext/to-html`            |

---

## 3. Architecture

- **Astro file-based routing.** Pages live under `src/pages/`, components under `src/components/`, content modules under `src/lib/`, types in `src/types/`.
- **Static by default.** Pages are pre-rendered at build time. `/api/*` routes opt into SSR via the Cloudflare adapter.
- **Single layout.** `src/layouts/BaseLayout.astro` provides `<head>`, canonical URL, robots meta, and the `noindex` prop.
- **Component organisation:** `src/components/sections/shared/` for reusable blocks; `src/components/ui/` for atoms; `src/components/forms/` for form primitives; `src/components/layout/` for header/footer.

---

## 4. Hosting & Deployment

### Cloudflare Pages

- Adapter: `@astrojs/cloudflare` with `imageService: 'compile'`.
- Build command: `pnpm build`
- Build output: `dist/`

### Wrangler config (`wrangler.jsonc`)

```jsonc
{
  "name": "living-legacy",
  "compatibility_date": "2026-05-25",
  "pages_build_output_dir": "dist",
}
```

### Branch & release workflow

- Feature branches off `master`.
- Each push gets a Cloudflare preview URL.
- PR target is `preview` for QA; `preview` → `master` once approved.
- Conventional Commits enforced via `commitlint`.

---

## 5. CMS — Sanity

- **Project ID**: _(set after Sanity project creation)_
- **Dataset**: `production`
- **API version**: `2026-05-25`
- **Hosted studio**: `living-legacy.sanity.studio`
- **Client config**: `src/lib/sanity.ts`

### Webhook

`src/pages/api/sanity-webhook.ts` verifies the Sanity HMAC signature and triggers the Cloudflare deploy hook on content publish.

---

## 6. CI/CD

- **`ci.yml`**: gitleaks → install → audit → type-check → build → commitlint. Runs on push to `master`.
- **`scheduled-rebuild.yml`**: hourly cron that POSTs to `CLOUDFLARE_DEPLOY_HOOK` to rebuild static pages with fresh Sanity content.
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

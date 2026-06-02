# Living Legacy Forest Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `livinglegacyforest.com.au` with the full Astro + Cloudflare + Sanity + Tailwind + Sentry stack, CI/CD workflows, and code quality tooling — matching the mornington-green tech foundation.

**Architecture:** Fresh Astro 5 scaffold layered with the Cloudflare adapter, Sanity integration, Tailwind CSS 4 (Vite plugin), and Sentry. Static-first rendering; `/api/*` routes opt into SSR via the Cloudflare Workers runtime. All tooling (Husky, commitlint, ESLint, Prettier, GitHub Actions, CodeRabbit, gitleaks) mirrors mornington-green.

**Tech Stack:** Astro 5, `@astrojs/cloudflare`, Tailwind CSS 4, Sanity, `@sentry/astro`, TypeScript strict, pnpm, Husky, commitlint, ESLint, Prettier, GitHub Actions, Cloudflare Pages.

---

## Prerequisites (human steps before running this plan)

1. Create a new Sanity project at https://sanity.io → note the **project ID**.
2. Create a new Sentry project named `living-legacy` under the `sister-creatives` org → note the **DSN**.
3. Ensure you have a Cloudflare Pages account and pnpm ≥ 9 installed.

---

### Task 1: Initialize git repo and scaffold Astro

**Files:**

- Create: `.node-version`
- Create: `src/env.d.ts`, `src/pages/index.astro`, `public/favicon.svg`, `.gitignore` (from scaffold — kept as-is)

- [ ] **Step 1: Initialize git on master branch**

```bash
cd /Users/warrenroberts/Developer/Project/livinglegacy
git init
git checkout -b master
```

Expected: `Initialized empty Git repository` + `Switched to a new branch 'master'`

- [ ] **Step 2: Pin Node version**

Create `.node-version`:

```
22.12.0
```

- [ ] **Step 3: Scaffold Astro into the current directory**

```bash
pnpm create astro@latest . --template minimal --no-install --no-git --yes
```

If prompted interactively: TypeScript → **Strict**, Install dependencies → **No**, Initialize git → **No**. If asked about existing files (`docs/`), confirm to continue.

Expected: scaffold creates `src/pages/index.astro`, `src/env.d.ts`, `astro.config.mjs`, `tsconfig.json`, `package.json`, `.gitignore`, `public/favicon.svg`.

- [ ] **Step 4: Verify scaffold output**

```bash
ls src/pages/ src/env.d.ts astro.config.mjs tsconfig.json package.json .gitignore public/favicon.svg
```

Expected: all files listed without errors.

---

### Task 2: Replace package.json and install all dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Replace package.json with full dependency manifest**

Write `package.json`:

```json
{
  "name": "living-legacy",
  "type": "module",
  "version": "0.0.1",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "astro dev",
    "prebuild": "node scripts/generate-redirects.mjs",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "astro check",
    "cloudinary:upload": "node scripts/upload-to-cloudinary.mjs",
    "cloudinary:dry": "node scripts/upload-to-cloudinary.mjs --dry-run",
    "studio:dev": "sanity dev",
    "studio:deploy": "sanity deploy",
    "prepare": "husky"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.6.13",
    "@astrojs/rss": "^4.0.18",
    "@portabletext/to-html": "^5.0.2",
    "@sanity/astro": "^3.4.0",
    "@sanity/client": "^7.17.0",
    "@sentry/astro": "^10.52.0",
    "@sentry/cloudflare": "^10.52.0",
    "@tailwindcss/vite": "^4.2.1",
    "astro": "^5.18.1",
    "embla-carousel": "^8.6.0",
    "lucide-astro": "^0.556.0",
    "motion": "^12.38.0",
    "sanity": "^5.25.0",
    "tailwindcss": "^4.2.1"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.7",
    "@astrojs/sitemap": "^3.7.2",
    "@commitlint/cli": "^20.5.2",
    "@commitlint/config-conventional": "^20.5.0",
    "@typescript-eslint/eslint-plugin": "^8.57.0",
    "@typescript-eslint/parser": "^8.57.0",
    "cloudinary": "^2.10.0",
    "eslint": "^9.39.4",
    "eslint-plugin-astro": "^1.6.0",
    "eslint-plugin-jsx-a11y": "^6.10.2",
    "husky": "^9.0.0",
    "prettier": "^3.8.1",
    "prettier-plugin-astro": "^0.14.1",
    "prettier-plugin-tailwindcss": "^0.8.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm install
```

Expected: `node_modules/` created, `pnpm-lock.yaml` written. No peer-dependency errors.

- [ ] **Step 3: Create scripts stubs (required by prebuild)**

```bash
mkdir -p scripts
```

Create `scripts/generate-redirects.mjs`:

```js
// Stub — populate when Sanity redirect schema is defined.
console.log('[generate-redirects] no-op stub');
```

Create `scripts/upload-to-cloudinary.mjs`:

```js
// Stub — populate when Cloudinary credentials are configured.
console.log('[upload-to-cloudinary] no-op stub');
```

---

### Task 3: Write astro.config.mjs

**Files:**

- Modify: `astro.config.mjs`

- [ ] **Step 1: Replace the scaffolded astro.config.mjs**

Write `astro.config.mjs`:

```js
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://livinglegacyforest.com.au',
  adapter: cloudflare({ imageService: 'compile' }),
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [
    sentry({
      org: 'sister-creatives',
      project: 'living-legacy',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourceMapsUploadOptions: {
        enabled: process.env.NODE_ENV === 'production',
      },
    }),
    sanity({
      projectId: process.env.SANITY_PROJECT_ID ?? 'placeholder',
      dataset: 'production',
      useCdn: true,
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      SANITY_PROJECT_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SANITY_DATASET: envField.string({
        context: 'server',
        access: 'secret',
        default: 'production',
      }),
      SANITY_API_VERSION: envField.string({
        context: 'server',
        access: 'secret',
        default: '2026-05-25',
      }),
      PUBLIC_HUBSPOT_PORTAL_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_SITE_ENV: envField.string({
        context: 'client',
        access: 'public',
        default: 'production',
      }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_CLOUDINARY_CLOUD_NAME: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_SANITY_PROJECT_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_SANITY_DATASET: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      EVENTBRITE_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      EVENTBRITE_ORG_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDFLARE_DEPLOY_HOOK: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SANITY_WEBHOOK_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDINARY_CLOUD_NAME: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDINARY_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDINARY_API_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
});
```

- [ ] **Step 2: Verify astro config parses**

```bash
pnpm exec astro info
```

Expected: prints Astro version and adapter info without errors.

---

### Task 4: Configure TypeScript

**Files:**

- Modify: `tsconfig.json`

- [ ] **Step 1: Replace tsconfig.json with strict project config**

Write `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "types": ["astro/client", "node"]
  }
}
```

- [ ] **Step 2: Run type-check to verify baseline passes**

```bash
pnpm type-check
```

Expected: passes (or only errors related to missing `src/` files we'll create later). No configuration errors.

---

### Task 5: Configure code quality (Prettier, ESLint, Biome)

**Files:**

- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `eslint.config.mjs`
- Create: `biome.json`

- [ ] **Step 1: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  "overrides": [
    {
      "files": "*.astro",
      "options": { "parser": "astro" }
    }
  ]
}
```

- [ ] **Step 2: Create .prettierignore**

```
# Build + tooling output
dist/
.astro/
node_modules/
playwright-report/
test-results/

# Lock files
package-lock.json
pnpm-lock.yaml
yarn.lock

# Generated
scripts/cloudinary-map.json

# Cloudflare's wrangler parser rejects Prettier's trailing commas
wrangler.jsonc

# Spec files — Prettier+Astro mis-parses prose angle brackets
docs/superpowers/specs/
```

- [ ] **Step 3: Create eslint.config.mjs**

```js
import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  { ignores: ['dist/**', '.astro/**', '.wrangler/**'] },

  // Astro files — use astro plugin's own parser + base rules
  ...eslintPluginAstro.configs['flat/base'],

  // TypeScript files
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_$|^e$',
        },
      ],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
    },
  },

  // Astro files — apply shared rules (parser already set by flat/base)
  {
    files: ['**/*.astro'],
    plugins: {
      '@typescript-eslint': tseslint,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
    },
  },
];
```

- [ ] **Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": {
    "ignore": ["**/*.astro", "**/node_modules/**", "**/.astro/**", "**/dist/**"]
  },
  "linter": {
    "enabled": false
  },
  "formatter": {
    "enabled": false
  }
}
```

- [ ] **Step 5: Verify ESLint runs cleanly**

```bash
pnpm lint
```

Expected: no errors (or only warnings on existing scaffold files).

---

### Task 6: Configure Husky and commitlint

**Files:**

- Create: `.husky/commit-msg`
- Create: `commitlint.config.cjs`

- [ ] **Step 1: Initialize Husky**

```bash
pnpm exec husky init
```

Expected: creates `.husky/` directory with a `pre-commit` hook.

- [ ] **Step 2: Remove default pre-commit hook and add commit-msg hook**

Delete `.husky/pre-commit` (the default). Create `.husky/commit-msg`:

```sh
npx --no -- commitlint --edit "$1"
```

- [ ] **Step 3: Create commitlint.config.cjs**

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'refactor',
        'docs',
        'style',
        'test',
        'perf',
        'build',
        'ci',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 100],
  },
};
```

- [ ] **Step 4: Verify commitlint config loads**

```bash
echo "feat: test" | pnpm exec commitlint
```

Expected: exits 0 (valid commit message).

```bash
echo "BAD COMMIT" | pnpm exec commitlint
```

Expected: exits non-zero with type error.

---

### Task 7: Configure Sanity (CLI, Studio, schema index)

**Files:**

- Create: `sanity.cli.ts`
- Create: `sanity.config.ts`
- Create: `src/sanity/schemaTypes/index.ts`

- [ ] **Step 1: Create sanity.cli.ts**

Replace `YOUR_SANITY_PROJECT_ID` with your actual project ID from the Sanity dashboard.

```ts
import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_PROJECT_ID ?? 'YOUR_SANITY_PROJECT_ID',
    dataset: 'production',
  },
  studioHost: 'living-legacy',
});
```

- [ ] **Step 2: Create sanity.config.ts**

```ts
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './src/sanity/schemaTypes';

export default defineConfig({
  name: 'living-legacy',
  title: 'Living Legacy Forest',
  projectId: process.env.SANITY_PROJECT_ID ?? 'YOUR_SANITY_PROJECT_ID',
  dataset: 'production',
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
```

- [ ] **Step 3: Create empty schema types index**

```bash
mkdir -p src/sanity/schemaTypes
```

Create `src/sanity/schemaTypes/index.ts`:

```ts
import type { SchemaTypeDefinition } from 'sanity';

export const schemaTypes: SchemaTypeDefinition[] = [];
```

---

### Task 8: Configure Sentry

**Files:**

- Create: `sentry.client.config.js`
- Create: `sentry.server.config.js`

- [ ] **Step 1: Create sentry.client.config.js**

Replace the DSN string with your actual Sentry DSN from the `living-legacy` project dashboard.

```js
import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: 'REPLACE_WITH_YOUR_SENTRY_DSN',
  integrations: [],
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],
});
```

- [ ] **Step 2: Create sentry.server.config.js**

```js
import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: 'REPLACE_WITH_YOUR_SENTRY_DSN',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
```

---

### Task 9: Scaffold src/ structure

**Files:**

- Create: `src/styles/global.css`
- Modify: `src/pages/index.astro`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/lib/sanity.ts`
- Create: `src/lib/integrations/webhook-auth.ts`
- Create: `src/pages/api/sanity-webhook.ts`
- Create: `src/types/index.ts`
- Create: `src/components/layout/.gitkeep`
- Create: `src/components/ui/.gitkeep`
- Create: `src/components/forms/.gitkeep`
- Create: `src/components/sections/shared/.gitkeep`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/styles \
         src/layouts \
         src/lib/integrations \
         src/types \
         src/pages/api \
         src/components/layout \
         src/components/ui \
         src/components/forms \
         src/components/sections/shared
touch src/components/layout/.gitkeep \
      src/components/ui/.gitkeep \
      src/components/forms/.gitkeep \
      src/components/sections/shared/.gitkeep
```

- [ ] **Step 2: Create Tailwind entry point**

Create `src/styles/global.css`:

```css
@import 'tailwindcss';
```

- [ ] **Step 3: Create BaseLayout.astro**

Create `src/layouts/BaseLayout.astro`:

```astro
---
import '@/styles/global.css';

interface Props {
  title: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
}

const {
  title,
  description = 'Living Legacy Forest',
  noindex = false,
  canonical = new URL(Astro.url.pathname, Astro.site).toString(),
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    {noindex && <meta name="robots" content="noindex, nofollow" />}
    <link rel="canonical" href={canonical} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Replace the scaffolded home page**

Write `src/pages/index.astro`:

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout title="Living Legacy Forest">
  <main>
    <h1>Living Legacy Forest</h1>
  </main>
</BaseLayout>
```

- [ ] **Step 5: Create Sanity client**

Create `src/lib/sanity.ts`:

```ts
import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID ?? 'placeholder',
  dataset: import.meta.env.SANITY_DATASET ?? 'production',
  apiVersion: import.meta.env.SANITY_API_VERSION ?? '2026-05-25',
  useCdn: true,
});
```

- [ ] **Step 6: Create webhook auth helper**

Create `src/lib/integrations/webhook-auth.ts`:

```ts
/**
 * Webhook auth helpers for deploy-trigger endpoints.
 * Written for the Cloudflare Workers runtime (Web Crypto API only — no Node crypto).
 *
 * Sanity sends a signed `sanity-webhook-signature` header:
 * format: `t=<unix-timestamp>,v1=<base64url-sig>`
 */

const SANITY_SIGNATURE_MAX_AGE_S = 5 * 60;

interface SanitySignatureParts {
  timestamp: number;
  signature: string;
}

function parseSanitySignatureHeader(header: string | null): SanitySignatureParts | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const eq = p.indexOf('=');
      return eq === -1 ? [p.trim(), ''] : [p.slice(0, eq).trim(), p.slice(eq + 1).trim()];
    })
  );
  const tsRaw = parts['t'];
  const sig = parts['v1'];
  if (!tsRaw || !sig) return null;
  const timestamp = Number(tsRaw);
  if (!Number.isFinite(timestamp)) return null;
  return { timestamp, signature: sig };
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifySanitySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  const parsed = parseSanitySignatureHeader(signatureHeader);
  if (!parsed) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > SANITY_SIGNATURE_MAX_AGE_S) {
    return false;
  }

  const encoder = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch {
    return false;
  }

  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parsed.timestamp}.${rawBody}`)
  );
  const computed = base64UrlEncode(sigBuffer);
  return timingSafeEqualStrings(computed, parsed.signature);
}

export function verifyEventbriteSecret(url: URL, expectedSecret: string): boolean {
  const provided = url.searchParams.get('secret');
  if (!provided) return false;
  return timingSafeEqualStrings(provided, expectedSecret);
}
```

- [ ] **Step 7: Create Sanity webhook API route**

Create `src/pages/api/sanity-webhook.ts`:

```ts
import type { APIRoute } from 'astro';
import { verifySanitySignature } from '@/lib/integrations/webhook-auth';

export const prerender = false;

/**
 * Sanity → Cloudflare Pages deploy trigger.
 *
 * Requires two env vars in Cloudflare Pages (Production AND Preview):
 *   SANITY_WEBHOOK_SECRET  — same value set on the Sanity webhook
 *   CLOUDFLARE_DEPLOY_HOOK — the project's deploy hook URL
 */
export const POST: APIRoute = async ({ request }) => {
  const deployHook = import.meta.env.CLOUDFLARE_DEPLOY_HOOK;
  const secret = import.meta.env.SANITY_WEBHOOK_SECRET;

  if (!deployHook) {
    console.warn('[sanity-webhook] CLOUDFLARE_DEPLOY_HOOK not configured');
    return new Response('Deploy hook not configured', { status: 500 });
  }

  if (!secret) {
    console.warn('[sanity-webhook] SANITY_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('sanity-webhook-signature');
  const valid = await verifySanitySignature(rawBody, signatureHeader, secret);

  if (!valid) {
    console.warn('[sanity-webhook] signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const response = await fetch(deployHook, { method: 'POST' });
    if (!response.ok) {
      console.warn(`[sanity-webhook] deploy hook returned ${response.status}`);
      return new Response('Deploy hook failed', { status: 502 });
    }
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.warn('[sanity-webhook] deploy fetch threw:', error);
    return new Response('Error triggering deploy', { status: 500 });
  }
};
```

- [ ] **Step 8: Create shared types index**

Create `src/types/index.ts`:

```ts
// Shared TypeScript types for livinglegacyforest.com.au
// Add Sanity document types here as schemas are defined.
export type {};
```

---

### Task 10: Set up infrastructure files

**Files:**

- Create: `wrangler.jsonc`
- Create: `.env.example`
- Create: `.gitleaks.toml`
- Create: `public/_redirects`
- Modify: `.gitignore`

- [ ] **Step 1: Create wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "living-legacy",
  "compatibility_date": "2026-05-25",
  "pages_build_output_dir": "dist",
}
```

- [ ] **Step 2: Create .env.example**

```bash
# =============================================================================
# PUBLIC VARS — exposed to the client bundle (safe to be public)
# =============================================================================

# HubSpot — portal ID used in embed scripts
PUBLIC_HUBSPOT_PORTAL_ID=

# Google Analytics 4 (optional). Format: G-XXXXXXXXXX
PUBLIC_GA_MEASUREMENT_ID=

# Cloudinary — cloud name used by the client-side URL builder
PUBLIC_CLOUDINARY_CLOUD_NAME=

# Sanity — used by generate-redirects script at build time
PUBLIC_SANITY_PROJECT_ID=
PUBLIC_SANITY_DATASET=production

# Site environment: development | staging | production
PUBLIC_SITE_ENV=development


# =============================================================================
# PRIVATE VARS — server-only; never exposed to the client bundle
# =============================================================================

# Sanity
SANITY_PROJECT_ID=
SANITY_DATASET=production
SANITY_API_VERSION=2026-05-25

# Cloudinary — server-side upload credentials
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Eventbrite (optional)
EVENTBRITE_API_KEY=
EVENTBRITE_ORG_ID=

# Cloudflare Pages — deploy hook URL (triggered by Sanity webhook + scheduled rebuild)
CLOUDFLARE_DEPLOY_HOOK=

# Sanity webhook signing secret
SANITY_WEBHOOK_SECRET=

# Sentry — build-time token for source map upload (not used at runtime)
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 3: Create .gitleaks.toml**

```toml
title = "Living Legacy Forest gitleaks config"

[allowlist]
  description = "Known public identifiers — not secrets"
  regexes = [
    # Add your Sanity project ID, HubSpot portal ID, Cloudinary cloud name here
    # once they are known. Example:
    # "\\byour-sanity-project-id\\b",
  ]
```

- [ ] **Step 4: Create public/\_redirects stub**

```bash
mkdir -p public
```

Create `public/_redirects`:

```
# Cloudflare Pages redirect rules — add entries as needed
```

- [ ] **Step 5: Append project-specific entries to .gitignore**

Open `.gitignore` and append at the end:

```
# Cloudflare
.wrangler/
.cloudflare/

# Environment
.env.local
.env.production

# macOS
.DS_Store

# JetBrains
.idea/

# Claude Code
.agents/
.claude/skills/
skills-lock.json
```

---

### Task 11: Set up GitHub Actions workflows

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/scheduled-rebuild.yml`
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create .github directories**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create ci.yml**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: Build + type-check + commitlint
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Secret scanning (gitleaks)
        run: |
          curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.27.2/gitleaks_8.27.2_linux_x64.tar.gz | tar -xz
          ./gitleaks detect --source . --config .gitleaks.toml --redact

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.32.1

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm

      - name: Install (frozen lockfile)
        run: pnpm install --frozen-lockfile

      - name: Audit dependencies
        run: pnpm audit --audit-level=critical

      - name: Type-check
        run: pnpm type-check

      - name: Build
        run: pnpm build

      - name: Lint commits
        uses: wagoid/commitlint-github-action@v6
```

- [ ] **Step 3: Create scheduled-rebuild.yml**

Create `.github/workflows/scheduled-rebuild.yml`:

```yaml
name: Scheduled rebuild

on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cloudflare Pages deploy hook
        run: |
          if [ -z "${{ secrets.CLOUDFLARE_DEPLOY_HOOK }}" ]; then
            echo "CLOUDFLARE_DEPLOY_HOOK secret is not set" >&2
            exit 1
          fi
          curl --fail --silent --show-error \
            --connect-timeout 10 \
            --max-time 30 \
            --retry 3 \
            --retry-all-errors \
            --retry-delay 5 \
            -X POST "${{ secrets.CLOUDFLARE_DEPLOY_HOOK }}"
```

- [ ] **Step 4: Create dependabot.yml**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '09:00'
      timezone: Australia/Melbourne
    open-pull-requests-limit: 5
    groups:
      astro-ecosystem:
        patterns:
          - 'astro'
          - '@astrojs/*'
      sanity:
        patterns:
          - 'sanity'
          - '@sanity/*'
      tailwind:
        patterns:
          - 'tailwindcss'
          - '@tailwindcss/*'
      lucide:
        patterns:
          - 'lucide-astro'
    ignore:
      - dependency-name: 'astro'
        update-types: ['version-update:semver-major']
      - dependency-name: 'sanity'
        update-types: ['version-update:semver-major']
      - dependency-name: 'tailwindcss'
        update-types: ['version-update:semver-major']

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '09:00'
      timezone: Australia/Melbourne
    open-pull-requests-limit: 3
```

---

### Task 12: Set up CodeRabbit

**Files:**

- Create: `.coderabbit.yaml`

- [ ] **Step 1: Create .coderabbit.yaml**

```yaml
language: 'en'

reviews:
  auto_review:
    enabled: true
    drafts: false
  poem: false
  path_filters:
    - '!pnpm-lock.yaml'
    - '!dist/**'
    - '!.cloudflare/**'
    - '!.claude/**'
    - '!docs/**'
    - '!public/**'
    - '!**/*.md'
```

---

### Task 13: Create TECH_SPEC.md

**Files:**

- Create: `TECH_SPEC.md`

- [ ] **Step 1: Create TECH_SPEC.md**

````markdown
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
````

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

````

---

### Task 14: Final verification and initial commit

- [ ] **Step 1: Run type-check**

```bash
pnpm type-check
````

Expected: exits 0. If errors appear in generated `.astro/` types, run `pnpm exec astro sync` first.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: `dist/` created, build succeeds. The `generate-redirects.mjs` stub prints `[generate-redirects] no-op stub` before the build.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: exits 0 or warnings only (no errors).

- [ ] **Step 4: Run format check**

```bash
pnpm format:check
```

Expected: exits 0 (all files formatted correctly).

- [ ] **Step 5: Stage and commit everything**

```bash
git add \
  .node-version \
  .gitignore \
  .prettierrc \
  .prettierignore \
  .gitleaks.toml \
  .coderabbit.yaml \
  .env.example \
  .husky/ \
  .github/ \
  astro.config.mjs \
  biome.json \
  commitlint.config.cjs \
  eslint.config.mjs \
  package.json \
  pnpm-lock.yaml \
  public/ \
  sanity.cli.ts \
  sanity.config.ts \
  scripts/ \
  sentry.client.config.js \
  sentry.server.config.js \
  src/ \
  tsconfig.json \
  wrangler.jsonc \
  TECH_SPEC.md \
  docs/

git commit -m "feat: scaffold livinglegacyforest.com.au foundation

Astro 5 + Cloudflare adapter + Sanity + Tailwind CSS 4 + Sentry.
Includes Husky/commitlint, ESLint/Prettier, GitHub Actions CI,
scheduled rebuild, Dependabot, CodeRabbit, and gitleaks."
```

Expected: commit created on `master`. Run `git log --oneline` to confirm.

---

## Post-setup checklist

After the plan is complete, complete these manual steps:

- [ ] Create a Sanity project and replace `YOUR_SANITY_PROJECT_ID` in `sanity.cli.ts` and `sanity.config.ts`, and fill in `SANITY_PROJECT_ID` in `.env`.
- [ ] Replace `REPLACE_WITH_YOUR_SENTRY_DSN` in `sentry.client.config.js` and `sentry.server.config.js`.
- [ ] Create a Cloudflare Pages project named `living-legacy` and connect the GitHub repo.
- [ ] Set all env vars from `.env.example` in the Cloudflare Pages dashboard (Production + Preview).
- [ ] Push to GitHub and confirm CI passes.
- [ ] Run `pnpm studio:deploy` to deploy the Sanity Studio to `living-legacy.sanity.studio`.
- [ ] Add the allowlisted public identifiers to `.gitleaks.toml` once Sanity project ID, HubSpot portal ID, and Cloudinary cloud name are known.

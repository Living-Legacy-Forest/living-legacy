import { cloudflare } from '@cloudflare/vite-plugin';
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Which build is running, shown on the dashboard. The release version lives in
// version.txt, which the release workflow bumps. CI provides the commit;
// a local build asks git, and falls back to "dev" outside a checkout.
function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

// Passed as VITE_ variables rather than `define` globals: Vite fills
// import.meta.env in dev as well as in builds, where bare globals are only
// replaced at build time and are "not defined" under `vite dev`.
process.env.VITE_APP_VERSION = readFileSync(new URL('version.txt', import.meta.url), 'utf8').trim();
process.env.VITE_APP_COMMIT = commitSha();
process.env.VITE_APP_BUILT_AT = new Date().toISOString();
// Sentry reports only from the production deploy, which CI builds on a push to
// master (deploy-cms.yml). Pull request previews and local builds stay silent.
process.env.VITE_SENTRY_ENVIRONMENT =
  process.env.GITHUB_ACTIONS !== 'true'
    ? 'development'
    : process.env.GITHUB_EVENT_NAME === 'pull_request'
      ? 'preview'
      : 'production';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    react(),
    // Last. Uploads source maps when SENTRY_AUTH_TOKEN is set (CI), then
    // deletes them from the build; without the token the build is unchanged.
    sentryTanstackStart({
      org: 'living-legacy',
      project: 'living-legacy-cms',
      release: { name: process.env.VITE_APP_COMMIT },
      telemetry: false,
      // It cannot follow `.middleware([requirePermission(…)])` and warns on
      // every server file; request and server function spans cover it.
      autoInstrumentMiddleware: false,
    }),
  ],
});

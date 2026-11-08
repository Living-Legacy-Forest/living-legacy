import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path('./src')}/` },
      // Node has no Workers runtime: tests get a plain `env` object instead,
      // which the integration setup fills with local D1 and R2.
      { find: 'cloudflare:workers', replacement: path('./test/cloudflare-workers.ts') },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        // Real SQL against the real migrations, in the same local D1 and R2
        // that `wrangler dev` uses. Each test file gets its own fresh copy.
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          globalSetup: ['test/migrate.ts'],
          setupFiles: ['test/integration-setup.ts'],
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

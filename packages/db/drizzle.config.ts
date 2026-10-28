import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations. They are applied with
// `wrangler d1 migrations apply`, which reads this folder via
// "migrations_dir" in apps/cms/wrangler.jsonc.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './migrations',
});

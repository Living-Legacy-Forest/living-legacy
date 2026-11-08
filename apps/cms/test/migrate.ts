import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** A local D1 with every migration applied; test files copy it. */
    d1Template: string;
    d1DatabaseId: string;
  }
}

const appDir = join(import.meta.dirname, '..');

/**
 * Applies the migrations once, with the same wrangler command as
 * `db:migrate:local`, into a template that every integration test file copies.
 */
export default async function setup(project: TestProject) {
  const dir = await mkdtemp(join(tmpdir(), 'll-cms-d1-template-'));
  const wrangler = join(
    dirname(createRequire(import.meta.url).resolve('wrangler/package.json')),
    'bin/wrangler.js'
  );
  execFileSync(
    process.execPath,
    [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir],
    { cwd: appDir, stdio: 'pipe' }
  );

  // Local D1 files are keyed by the database id in wrangler.jsonc.
  const config = await readFile(join(appDir, 'wrangler.jsonc'), 'utf8');
  const databaseId = /"database_id":\s*"([^"]+)"/.exec(config)?.[1];
  if (!databaseId) throw new Error('No database_id in wrangler.jsonc');

  project.provide('d1Template', dir);
  project.provide('d1DatabaseId', databaseId);
  return () => rm(dir, { recursive: true, force: true });
}

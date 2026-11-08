import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, inject } from 'vitest';
import { env } from './cloudflare-workers';

let mf: Miniflare | undefined;
let dir: string | undefined;

// Each test file gets its own copy of the migrated database, so files can run
// in parallel without seeing each other's rows.
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'll-cms-d1-'));
  await cp(inject('d1Template'), dir, { recursive: true });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch: () => new Response(null, { status: 404 }) }',
      d1Databases: { DB: inject('d1DatabaseId') },
      r2Buckets: ['MEDIA'],
      resourcePersistencePath: join(dir, 'v3'),
    })
  );
  // Miniflare's binding types are its own copies of the Workers ones.
  Object.assign(env, {
    DB: (await mf.getD1Database('DB')) as unknown as D1Database,
    MEDIA: (await mf.getR2Bucket('MEDIA')) as unknown as R2Bucket,
    BETTER_AUTH_URL: 'http://localhost:3100',
  });
});

afterAll(async () => {
  await mf?.dispose();
  if (dir) await rm(dir, { recursive: true, force: true });
});

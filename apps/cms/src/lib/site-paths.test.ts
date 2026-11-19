import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATIC_SITE_PATHS } from '@ll/content';
import { describe, expect, it } from 'vitest';

// Redirect coverage needs to know which pages the new site serves. The fixed ones are listed by
// hand in @ll/content, so a new page in the website has to be added there, or an old address that
// lands on it would be reported as needing a redirect.
describe('STATIC_SITE_PATHS', () => {
  const pages = (dir: string) =>
    readdirSync(fileURLToPath(new URL(`../../../web/src/pages/${dir}`, import.meta.url)), {
      withFileTypes: true,
    });

  it('has every fixed page the website serves', () => {
    const found: string[] = [];
    for (const [dir, prefix] of [
      ['', '/'],
      ['about', '/about/'],
      ['blog', '/blog/'],
      ['locations', '/locations/'],
    ] as const) {
      for (const entry of pages(dir)) {
        const name = /^(.+)\.astro$/.exec(entry.name)?.[1];
        // 404 is not a page to link to, and [slug] pages come from the CMS.
        if (!name || name === '404' || name.startsWith('[')) continue;
        found.push(`${prefix}${name === 'index' ? '' : name}`.replace(/\/$/, '') || '/');
      }
    }
    expect(found.length).toBeGreaterThan(5);
    expect(found.filter((path) => !STATIC_SITE_PATHS.includes(path))).toEqual([]);
  });
});

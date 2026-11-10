import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAllowedRichText, markdownToRichText, outlineRichText } from '@ll/content';
import { describe, expect, it } from 'vitest';

const source = (slug: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../scripts/legal-pages/${slug}.md`, import.meta.url)),
    'utf8'
  );

describe('legal page seed text', () => {
  it.each([
    ['privacy', 9],
    ['terms-and-conditions', 4],
  ])('%s converts to valid rich text with its %i sections', (slug, sections) => {
    const doc = markdownToRichText(source(slug));
    expect(isAllowedRichText(doc)).toBe(true);
    const h2s = outlineRichText(doc).headings.filter((h) => h.level === 2);
    expect(h2s).toHaveLength(sections);
  });
});

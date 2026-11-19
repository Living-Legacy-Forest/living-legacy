// Scans one piece of published content for the brand language guide, for the Content checks
// page. Pure, so it can be tested without a database: the CMS feeds it each item's text.
import { type BrandFinding, type BrandRule, findBrandProblems } from './brand-language';
import { outlineRichText } from './rich-text-outline';
import type { RichTextDoc } from './posts';

/** A piece of an item's wording: plain text, or a rich text document (its text and image alts). */
export type BrandScanPart = string | RichTextDoc | null | undefined;

export interface BrandScanResult {
  /** What the guide rules out, as it was written: words never to use, and misspelt names. */
  never: Pick<BrandFinding, 'found' | 'count' | 'instead' | 'kind'>[];
  /** Words that are usually wrong but sometimes fine in context. Counted, not listed. */
  avoid: number;
}

/**
 * What an item breaks in the guide, or null when it breaks nothing that must be fixed.
 * Only the "never" findings make an item fail; "usually wrong" ones come along as a count, so a
 * list of things to fix is not buried in judgement calls.
 */
export function scanBrand(
  parts: readonly BrandScanPart[],
  rules?: readonly BrandRule[]
): BrandScanResult | null {
  const pieces: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string') pieces.push(part.trim());
    else if (part) {
      const outline = outlineRichText(part);
      pieces.push(outline.text, ...outline.imageAlts);
    }
  }
  // Each distinct piece once: a search title that repeats the title would double every count.
  const text = [...new Set(pieces.filter(Boolean))].join('\n');
  if (!text) return null;

  const findings = findBrandProblems(text, rules);
  const never = findings
    .filter((f) => f.severity === 'critical')
    .map(({ found, count, instead, kind }) => ({ found, count, instead, kind }));
  if (never.length === 0) return null;
  return {
    never,
    avoid: findings.filter((f) => f.severity === 'warning' && f.kind === 'term').length,
  };
}

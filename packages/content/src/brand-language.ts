// Words the brand language guide rules out, for the content score. Source:
// docs/brand-language.md. BRAND_RULES is the starting list; admins edit their
// own copy in Settings (`brandRules`), which is what posts are scored against.
import { z } from 'zod';
import { phraseRegex } from './rich-text-outline';

export type BrandSeverity = 'critical' | 'warning';

export interface BrandRule {
  match: string;
  instead: string;
  /** critical: never write it. warning: usually wrong, sometimes fine in context. */
  severity: BrandSeverity;
}

export interface BrandFinding {
  /** The first match, as written. */
  found: string;
  count: number;
  instead: string;
  severity: BrandSeverity;
  kind: 'term' | 'spelling';
}

const GROUND = 'Legacy Ground, or their tree';
const PERSON = "the person's name or relationship, such as your mum";
const TREATMENT = 'EarthSApHE™ Treatment';
const FOREST = 'Living Legacy Forest';
const CEREMONY = 'Legacy Infusion Ceremony';
const CALM = 'state the facts, with no urgency';

export const BRAND_RULES: readonly BrandRule[] = [
  { match: 'plot', instead: GROUND, severity: 'critical' },
  { match: 'plots', instead: GROUND, severity: 'critical' },
  { match: 'grave', instead: GROUND, severity: 'critical' },
  { match: 'graves', instead: GROUND, severity: 'critical' },
  { match: 'final resting place', instead: GROUND, severity: 'critical' },
  { match: 'resting place', instead: GROUND, severity: 'critical' },
  { match: 'cremains', instead: 'ashes', severity: 'critical' },
  { match: 'the deceased', instead: PERSON, severity: 'critical' },
  {
    match: 'paramagnetic',
    instead: 'what the treatment does, in plain words',
    severity: 'critical',
  },
  { match: 'SoilSAFE', instead: TREATMENT, severity: 'critical' },
  { match: 'SSAFE', instead: TREATMENT, severity: 'critical' },
  { match: 'Living Legacy Formula', instead: TREATMENT, severity: 'critical' },
  { match: 'Living Legacy Liquid', instead: TREATMENT, severity: 'critical' },
  { match: 'limited availability', instead: CALM, severity: 'critical' },
  { match: 'act now', instead: CALM, severity: 'critical' },
  { match: 'enquire for pricing', instead: 'show the price', severity: 'critical' },
  { match: 'Mornington Green', instead: 'Living Legacy Mornington', severity: 'critical' },
  { match: 'remains', instead: 'ashes (fine as an ordinary verb)', severity: 'warning' },
  { match: 'cemetery', instead: 'fine only when comparing', severity: 'warning' },
  { match: 'cemeteries', instead: 'fine only when comparing', severity: 'warning' },
  { match: 'formula', instead: TREATMENT, severity: 'warning' },
  { match: 'liquid', instead: TREATMENT, severity: 'warning' },
  { match: 'treated ashes', instead: 'EarthSApHE™ Ashes', severity: 'warning' },
  { match: 'loved one', instead: PERSON, severity: 'warning' },
  { match: 'loved ones', instead: PERSON, severity: 'warning' },
  { match: 'the departed', instead: PERSON, severity: 'warning' },
  { match: 'memorial garden', instead: FOREST, severity: 'warning' },
  { match: 'memorial park', instead: FOREST, severity: 'warning' },
  { match: 'sanctuary', instead: FOREST, severity: 'warning' },
  { match: 'interment', instead: CEREMONY, severity: 'warning' },
  { match: 'burial', instead: CEREMONY, severity: 'warning' },
  { match: 'salesperson', instead: 'Legacy Planner', severity: 'warning' },
  { match: 'officiant', instead: 'celebrant', severity: 'warning' },
];

export const brandSeverities = ['critical', 'warning'] as const;

/** One rule as an admin edits it in Settings. */
export const brandRuleSchema = z.object({
  match: z
    .string()
    .trim()
    .min(1, 'Each rule needs a word or phrase to look for.')
    .max(60, 'Keep each word or phrase to 60 characters.'),
  instead: z
    .string()
    .trim()
    .min(1, 'Each rule needs what to write instead.')
    .max(160, 'Keep "write instead" to 160 characters.'),
  severity: z.enum(brandSeverities),
});

export const BRAND_RULES_MAX = 200;

export const brandRulesSchema = z
  .array(brandRuleSchema)
  .max(BRAND_RULES_MAX, `Keep the list to ${BRAND_RULES_MAX} rules.`)
  .superRefine((rules, ctx) => {
    const problem = brandRulesProblem(rules);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

/** A sentence naming the first blank or repeated word, or null. */
export function brandRulesProblem(
  rules: readonly (Pick<BrandRule, 'match'> & { instead?: string })[]
): string | null {
  const seen = new Set<string>();
  for (const { match, instead } of rules) {
    if (!match.trim()) return 'A brand language rule has no word or phrase.';
    if (instead !== undefined && !instead.trim()) {
      return `"${match.trim()}" in the brand language list needs what to write instead.`;
    }
    const key = match.trim().toLowerCase();
    if (seen.has(key)) return `"${match.trim()}" is in the brand language list twice.`;
    seen.add(key);
  }
  return null;
}

/** A stored list, or null when there is none or it is not valid (the defaults apply). */
export function parseBrandRules(value: unknown): BrandRule[] | null {
  const parsed = brandRulesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Longest first, and each match is blanked out once found, so "final resting
// place" is not reported again as "resting place". Sorted once per list.
const longestFirst = new WeakMap<readonly BrandRule[], BrandRule[]>();
function sortedRules(rules: readonly BrandRule[]) {
  let sorted = longestFirst.get(rules);
  if (!sorted) {
    sorted = [...rules].sort((a, b) => b.match.length - a.match.length);
    longestFirst.set(rules, sorted);
  }
  return sorted;
}

export function findBrandProblems(
  text: string,
  rules: readonly BrandRule[] = BRAND_RULES
): BrandFinding[] {
  const findings: BrandFinding[] = [];
  let rest = text;
  for (const rule of sortedRules(rules)) {
    let found = '';
    let count = 0;
    rest = rest.replace(phraseRegex(rule.match), (match) => {
      if (count === 0) found = match;
      count += 1;
      return ' '.repeat(match.length);
    });
    if (count) {
      findings.push({ found, count, instead: rule.instead, severity: rule.severity, kind: 'term' });
    }
  }

  const misspelt = new Map<string, number>();
  for (const [match] of text.matchAll(/earth\s?saphe/gi)) {
    if (match !== 'EarthSApHE') misspelt.set(match, (misspelt.get(match) ?? 0) + 1);
  }
  for (const [found, count] of misspelt) {
    findings.push({ found, count, instead: 'EarthSApHE', severity: 'critical', kind: 'spelling' });
  }

  // Stable sort: rule order within each severity is kept.
  return findings.sort(
    (a, b) => Number(a.severity === 'warning') - Number(b.severity === 'warning')
  );
}

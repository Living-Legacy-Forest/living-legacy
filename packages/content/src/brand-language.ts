// Words the brand language guide rules out, for the content score. Source:
// docs/brand-language.md. When the guide changes, update both together.
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

// Longest first, and each match is blanked out once found, so "final resting
// place" is not reported again as "resting place".
const LONGEST_FIRST = [...BRAND_RULES].sort((a, b) => b.match.length - a.match.length);

export function findBrandProblems(text: string): BrandFinding[] {
  const findings: BrandFinding[] = [];
  let rest = text;
  for (const rule of LONGEST_FIRST) {
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

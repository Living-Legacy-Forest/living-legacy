import { describe, expect, it } from 'vitest';
import {
  BRAND_RULES,
  brandRulesProblem,
  findBrandProblems,
  parseBrandRules,
} from './brand-language';

describe('findBrandProblems', () => {
  it('reports a never-use word with how it was written and how often', () => {
    expect(findBrandProblems('A grave. Another Grave.')).toEqual([
      {
        found: 'grave',
        count: 2,
        instead: 'Legacy Ground, or their tree',
        severity: 'critical',
        kind: 'term',
      },
    ]);
  });

  it('matches whole words only', () => {
    expect(findBrandProblems('He was gravely ill. A clever plotline.')).toEqual([]);
  });

  it('reports the longest phrase once, not the shorter phrase inside it', () => {
    const found = findBrandProblems('Their final resting place.').map((f) => f.found);
    expect(found).toEqual(['final resting place']);
  });

  it('tells the old treatment name apart from the plain word', () => {
    const findings = findBrandProblems('The Living Legacy Formula, not a formula.');
    expect(findings.map((f) => [f.found, f.severity])).toEqual([
      ['Living Legacy Formula', 'critical'],
      ['formula', 'warning'],
    ]);
  });

  it('treats remains as a warning, since it is also an ordinary verb', () => {
    expect(findBrandProblems('The question remains.')[0]).toMatchObject({
      found: 'remains',
      severity: 'warning',
    });
  });

  it('flags the retired forest name but not the old domain', () => {
    expect(findBrandProblems('Visit Mornington Green.')[0]?.instead).toBe(
      'Living Legacy Mornington'
    );
    expect(findBrandProblems('morningtongreen.com.au')).toEqual([]);
  });

  it('reports each misspelling of EarthSApHE and accepts the right one', () => {
    const findings = findBrandProblems(
      'EARTHSAPHE, Earth SApHE, earthsaphe and EarthSApHE™ Ashes.'
    );
    expect(findings).toEqual([
      {
        found: 'EARTHSAPHE',
        count: 1,
        instead: 'EarthSApHE',
        severity: 'critical',
        kind: 'spelling',
      },
      {
        found: 'Earth SApHE',
        count: 1,
        instead: 'EarthSApHE',
        severity: 'critical',
        kind: 'spelling',
      },
      {
        found: 'earthsaphe',
        count: 1,
        instead: 'EarthSApHE',
        severity: 'critical',
        kind: 'spelling',
      },
    ]);
  });

  it('lists critical findings before warnings', () => {
    const severities = findBrandProblems('A cemetery, a plot.').map((f) => f.severity);
    expect(severities).toEqual(['critical', 'warning']);
  });
});

describe('an edited rule list', () => {
  const rules = [
    { match: 'cheap', instead: 'affordable', severity: 'critical' as const },
    { match: 'plot', instead: 'Legacy Ground', severity: 'warning' as const },
  ];

  it('flags only the words on it, with its own severity', () => {
    const found = findBrandProblems('A cheap plot near the grave.', rules);
    expect(found.map((f) => [f.found, f.severity])).toEqual([
      ['cheap', 'critical'],
      ['plot', 'warning'],
    ]);
  });

  it('still checks how EarthSApHE is spelt', () => {
    expect(findBrandProblems('Earthsaphe', []).map((f) => f.kind)).toEqual(['spelling']);
  });

  it('refuses a word listed twice, in any case', () => {
    expect(brandRulesProblem([{ match: 'Plot' }, { match: ' plot ' }])).toBe(
      '"plot" is in the brand language list twice.'
    );
    expect(brandRulesProblem(BRAND_RULES)).toBeNull();
  });

  it('refuses a rule with a blank word or nothing to write instead', () => {
    expect(brandRulesProblem([{ match: ' ', instead: 'x' }])).toBe(
      'A brand language rule has no word or phrase.'
    );
    expect(brandRulesProblem([{ match: 'cheap', instead: '' }])).toBe(
      '"cheap" in the brand language list needs what to write instead.'
    );
  });

  it('reads a stored list, or null when it is not valid', () => {
    expect(parseBrandRules(rules)).toEqual(rules);
    expect(parseBrandRules([{ match: '', instead: 'x', severity: 'critical' }])).toBeNull();
    expect(parseBrandRules('plot')).toBeNull();
  });
});

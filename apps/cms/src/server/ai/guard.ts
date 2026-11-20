import { type BrandRule, findBrandProblems } from '@ll/content';

/**
 * What is wrong with a suggestion, one plain sentence each, written so it can be read back to the
 * model as feedback. Empty means it passes. Only "critical" brand findings count: a word that is
 * "usually wrong" is a judgement call a person can make.
 */
export function guardProblems(
  text: string,
  {
    limit,
    rules,
    allowed,
  }: { limit: number; rules: readonly BrandRule[]; allowed?: readonly string[] }
): string[] {
  const problems: string[] = [];
  if (text.trim() === '') return ['The reply was empty.'];

  for (const finding of findBrandProblems(text, rules)) {
    if (finding.severity !== 'critical') continue;
    problems.push(`Do not use "${finding.found}"; write "${finding.instead}" instead.`);
  }
  if (/[—–]/.test(text)) problems.push('Do not use an em dash or an en dash.');
  if (text.includes('!')) problems.push('Do not use an exclamation mark.');
  if (text.length > limit) {
    problems.push(`It is ${text.length} characters; it must be at most ${limit}.`);
  }
  if (allowed && !allowed.some((name) => name.toLowerCase() === text.trim().toLowerCase())) {
    problems.push(`"${text}" is not one of the existing options; choose only from the list.`);
  }
  return problems;
}

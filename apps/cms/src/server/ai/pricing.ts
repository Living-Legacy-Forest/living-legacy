/**
 * Claude Haiku 5.5's list prices in US dollars per million tokens, for the estimate on the System
 * page. Rates as of November 2026, for prompts up to 100,000 tokens (suggestions are far smaller).
 * A cache write is 1.25 times the input rate and a cache read a tenth of it. The Anthropic Console
 * has the real bill; change these if the model or its prices change.
 */
const PER_MILLION = { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 } as const;

export type TokenUse = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export function estimateCostUsd(use: TokenUse): number {
  return (
    (use.inputTokens * PER_MILLION.input +
      use.outputTokens * PER_MILLION.output +
      use.cacheReadTokens * PER_MILLION.cacheRead +
      use.cacheWriteTokens * PER_MILLION.cacheWrite) /
    1_000_000
  );
}

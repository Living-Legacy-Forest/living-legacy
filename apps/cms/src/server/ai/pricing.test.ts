import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from './pricing';

describe('estimateCostUsd', () => {
  it('is nothing for nothing', () => {
    expect(
      estimateCostUsd({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })
    ).toBe(0);
  });

  it('prices a million of each kind of token at its own rate', () => {
    const million = 1_000_000;
    expect(
      estimateCostUsd({
        inputTokens: million,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(0.1);
    expect(
      estimateCostUsd({
        inputTokens: 0,
        outputTokens: million,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(0.5);
    expect(
      estimateCostUsd({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: million,
        cacheWriteTokens: 0,
      })
    ).toBeCloseTo(0.01);
    expect(
      estimateCostUsd({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: million,
      })
    ).toBeCloseTo(0.125);
  });

  it('comes to about a twentieth of a cent for a typical suggestion', () => {
    const cost = estimateCostUsd({
      inputTokens: 2500,
      outputTokens: 300,
      cacheReadTokens: 2700,
      cacheWriteTokens: 0,
    });
    expect(cost).toBeGreaterThan(0.0003);
    expect(cost).toBeLessThan(0.0007);
  });
});

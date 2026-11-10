import { describe, expect, it } from 'vitest';
import { isNewerDeploy } from './build-check';

describe('isNewerDeploy', () => {
  it('is true when the deployed commit differs from the running one', () => {
    expect(isNewerDeploy('abc1234', 'def5678')).toBe(true);
  });

  it('is false for the same commit', () => {
    expect(isNewerDeploy('abc1234', 'abc1234')).toBe(false);
  });

  it('never fires in local development or without an answer', () => {
    expect(isNewerDeploy('dev', 'def5678')).toBe(false);
    expect(isNewerDeploy('abc1234', 'dev')).toBe(false);
    expect(isNewerDeploy('abc1234', null)).toBe(false);
    expect(isNewerDeploy('abc1234', '')).toBe(false);
  });
});

import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { describeFailure } from './describe-failure';

describe('describeFailure', () => {
  const typed = ['Sam', 'Tester', 'sam@example.test'];

  it('gives only the database reason for a failed query', () => {
    const error = new DrizzleQueryError(
      'insert into t values (?)',
      typed,
      new Error('D1_ERROR: x')
    );
    expect(describeFailure(error)).toBe('query failed: D1_ERROR: x');
  });

  it('still hides the values when the error is not the same class', () => {
    const lookalike = Object.assign(new Error('Failed query: select 1\nparams: Sam'), {
      params: ['Sam'],
    });
    expect(describeFailure(lookalike)).toBe('query failed: no reason given');
    expect(describeFailure(new Error('Failed query: select 1\nparams: Sam'))).not.toContain('Sam');
  });

  it('keeps the message and cause of other errors', () => {
    expect(describeFailure(new Error('boom', { cause: new Error('why') }))).toBe('boom (why)');
    expect(describeFailure(new Error('boom'))).toBe('boom');
    expect(describeFailure('nope')).toBe('unknown error');
  });
});

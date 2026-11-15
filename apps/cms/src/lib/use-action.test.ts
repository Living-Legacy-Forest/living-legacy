import { describe, expect, it } from 'vitest';
import { createRunner } from './use-action';

describe('createRunner', () => {
  it('lets the caller move on before the loaders refresh', async () => {
    const calls: string[] = [];
    const run = createRunner({
      invalidate: async () => void calls.push('invalidate'),
      setPending: (pending) => void calls.push(pending ? 'pending' : 'idle'),
    });

    const result = await run(async () => 7, {
      error: 'Could not do it',
      afterAction: async (n) => void calls.push(`after ${n}`),
    });

    expect(result).toBe(7);
    expect(calls).toEqual(['pending', 'after 7', 'invalidate', 'idle']);
  });

  it('refreshes as before when nothing is asked of it', async () => {
    const calls: string[] = [];
    const run = createRunner({
      invalidate: async () => void calls.push('invalidate'),
      setPending: () => {},
    });

    expect(await run(async () => 'ok', { error: 'Could not do it' })).toBe('ok');
    expect(calls).toEqual(['invalidate']);
  });
});

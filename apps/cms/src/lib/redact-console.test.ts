import { afterAll, describe, expect, it, vi } from 'vitest';

describe('redact-console', () => {
  const original = console.error;
  afterAll(() => {
    console.error = original;
  });

  it('masks email addresses in messages, errors and objects before they are logged', async () => {
    const seen: unknown[][] = [];
    console.error = (...args: unknown[]) => void seen.push(args);
    vi.resetModules();
    await import('./redact-console');

    const error = new Error('HubSpot rejected jo.tester@example.com');
    console.error('[events] failed for', 'sam@example.org', error, { email: 'ana@example.net' });

    const [message, address, logged, object] = seen[0]!;
    expect(message).toBe('[events] failed for');
    expect(address).toBe('s***@example.org');
    expect((logged as Error).message).toBe('HubSpot rejected j***@example.com');
    expect(object).toEqual({ email: 'a***@example.net' });
    // The original error, which Sentry reports, is left as it was.
    expect(error.message).toBe('HubSpot rejected jo.tester@example.com');
  });
});

import { describe, expect, it } from 'vitest';
import { scrubEmails, scrubEvent } from './sentry';

describe('scrubEmails', () => {
  it('masks addresses anywhere in an event, leaving the rest alone', () => {
    const event = {
      message: 'Sync failed for jo.tester@example.com',
      exception: { values: [{ type: 'Error', value: 'HubSpot rejected sam@example.org' }] },
      breadcrumbs: [{ message: 'Booking ana@example.net added', level: 'info' }],
      user: { id: 'user-1' },
      tags: { role: 'editor' },
    };
    expect(scrubEmails(event)).toEqual({
      message: 'Sync failed for j***@example.com',
      exception: { values: [{ type: 'Error', value: 'HubSpot rejected s***@example.org' }] },
      breadcrumbs: [{ message: 'Booking a***@example.net added', level: 'info' }],
      user: { id: 'user-1' },
      tags: { role: 'editor' },
    });
  });

  it('gives back an event it cannot copy as it was', () => {
    const circular: Record<string, unknown> = { message: 'x' };
    circular.self = circular;
    expect(scrubEmails(circular)).toBe(circular);
  });
});

describe('sentryOptions', () => {
  // With span streaming (the SDK's default) these are ignored, and the SDK logs a warning on every
  // request. Masking and filtering belong on spans.
  it('uses no transaction hooks, which the SDK ignores', async () => {
    const { sentryOptions } = await import('./sentry');
    expect(sentryOptions).not.toHaveProperty('beforeSendTransaction');
    expect(sentryOptions).not.toHaveProperty('ignoreTransactions');
  });

  it('masks email addresses in spans', async () => {
    const { sentryOptions } = await import('./sentry');
    const span = {
      name: 'GET /login',
      attributes: { 'url.full': { value: '/login?email=jo@example.com' } },
    };
    expect(JSON.stringify(sentryOptions.beforeSendSpan(span as never))).not.toContain(
      'jo@example.com'
    );
  });
});

describe('scrubEvent', () => {
  it('filters the internal key from request headers, whatever the case, and still masks emails', () => {
    const event = {
      message: 'Failed for jo.tester@example.com',
      request: { headers: { 'X-Internal-Key': 'super-secret', accept: 'application/json' } },
    };
    expect(scrubEvent(event)).toEqual({
      message: 'Failed for j***@example.com',
      request: { headers: { 'X-Internal-Key': '[Filtered]', accept: 'application/json' } },
    });
  });

  it('filters the key from span attributes', async () => {
    const { sentryOptions } = await import('./sentry');
    const span = {
      name: 'POST /internal/events/book',
      attributes: {
        'http.request.header.x_internal_key': { type: 'string', value: 'super-secret' },
        'http.method': { type: 'string', value: 'POST' },
      },
    };
    const out = JSON.stringify(sentryOptions.beforeSendSpan(span as never));
    expect(out).not.toContain('super-secret');
    expect(out).toContain('[Filtered]');
    expect(out).toContain('POST');
  });

  it('gives back an event it cannot copy as it was', () => {
    const circular: Record<string, unknown> = { message: 'x' };
    circular.self = circular;
    expect(scrubEvent(circular)).toBe(circular);
  });
});

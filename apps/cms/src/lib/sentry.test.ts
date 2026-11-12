import { describe, expect, it } from 'vitest';
import { scrubEmails } from './sentry';

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

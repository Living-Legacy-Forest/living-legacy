import { describe, expect, it } from 'vitest';
import { legacyEventRedirect } from './legacy-event-link';

describe('legacyEventRedirect', () => {
  it('sends an old ?open= link to the event page, on the tab it named', () => {
    expect(legacyEventRedirect({ open: 'abc', view: 'guests' })).toEqual({
      to: '/events/$eventId',
      params: { eventId: 'abc' },
      search: { view: 'guests' },
    });
  });

  it('keeps the first tab out of the address', () => {
    expect(legacyEventRedirect({ open: 'abc' })).toEqual({
      to: '/events/$eventId',
      params: { eventId: 'abc' },
      search: {},
    });
  });

  it('leaves the plain events list alone', () => {
    expect(legacyEventRedirect({})).toBeNull();
  });
});

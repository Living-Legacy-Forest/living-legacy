import { describe, expect, it } from 'vitest';
import {
  HUBSPOT_EVENT_PROPERTIES,
  type CrmBooking,
  hubspotBookingProperties,
  latestPerEmail,
} from './event-crm';

const booking = (over: Partial<CrmBooking> = {}): CrmBooking => ({
  id: 'b1',
  email: 'jo@example.com',
  firstName: 'Jo',
  lastName: 'Tester',
  phone: '0400 000 000',
  partySize: 2,
  reference: 'LL-ABC234',
  status: 'confirmed',
  createdAt: 1_000,
  cancelledAt: null,
  event: {
    title: 'Open day, Mornington',
    startsAt: Date.UTC(2026, 10, 13, 23, 0),
    venue: '125 Tyabb-Tooradin Rd, Somerville VIC 3912',
    locationName: 'Living Legacy Mornington',
    status: 'published',
  },
  ...over,
});

describe('hubspotBookingProperties', () => {
  it('maps a booking to contact properties', () => {
    expect(hubspotBookingProperties(booking())).toEqual({
      firstname: 'Jo',
      lastname: 'Tester',
      phone: '0400 000 000',
      ll_event_name: 'Open day, Mornington',
      ll_event_start: String(Date.UTC(2026, 10, 13, 23, 0)),
      ll_event_venue: '125 Tyabb-Tooradin Rd, Somerville VIC 3912',
      ll_event_location: 'Living Legacy Mornington',
      ll_event_party_size: '2',
      ll_event_reference: 'LL-ABC234',
      ll_event_status: 'booked',
    });
  });

  it('leaves out empty names and phones, so HubSpot keeps what it has', () => {
    const props = hubspotBookingProperties(booking({ lastName: '', phone: null }));
    expect(props).not.toHaveProperty('lastname');
    expect(props).not.toHaveProperty('phone');
  });

  it('says when the booking or the whole event was cancelled', () => {
    expect(hubspotBookingProperties(booking({ status: 'cancelled' })).ll_event_status).toBe(
      'cancelled'
    );
    const event = { ...booking().event, status: 'cancelled' as const };
    expect(hubspotBookingProperties(booking({ event })).ll_event_status).toBe('event_cancelled');
  });

  it('keeps a guest who cancelled as cancelled when the event is cancelled later', () => {
    const event = { ...booking().event, status: 'cancelled' as const };
    expect(hubspotBookingProperties(booking({ status: 'cancelled', event })).ll_event_status).toBe(
      'cancelled'
    );
  });

  it('only uses property names it defines', () => {
    const defined = new Set<string>(HUBSPOT_EVENT_PROPERTIES.map((p) => p.name));
    for (const key of Object.keys(hubspotBookingProperties(booking()))) {
      if (key.startsWith('ll_')) expect(defined.has(key)).toBe(true);
    }
  });
});

describe('latestPerEmail', () => {
  it('keeps one booking per address, the most recently changed', () => {
    const older = booking({ id: 'old', createdAt: 1_000 });
    const newer = booking({ id: 'new', createdAt: 2_000 });
    const cancelledLater = booking({ id: 'cancel', createdAt: 500, cancelledAt: 3_000 });
    const other = booking({ id: 'other', email: 'sam@example.com' });
    const kept = latestPerEmail([older, newer, cancelledLater, other]).map((b) => b.id);
    expect(kept.sort()).toEqual(['cancel', 'other']);
  });

  it('matches addresses regardless of case', () => {
    const a = booking({ id: 'a', email: 'Jo@Example.com', createdAt: 1 });
    const b = booking({ id: 'b', email: 'jo@example.com', createdAt: 2 });
    expect(latestPerEmail([a, b]).map((x) => x.id)).toEqual(['b']);
  });
});

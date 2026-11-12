// Event bookings as HubSpot contact properties. HubSpot sends every guest email
// (confirmation, reminder, cancellation) from workflows that watch these
// properties, so the CMS only keeps them current. A contact holds one booking
// at a time: the most recently changed one.
import { googleCalendarUrl, ticketCalendarPath, ticketQrPath } from './tickets';

export type CrmBooking = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  partySize: number;
  reference: string;
  status: 'confirmed' | 'cancelled';
  createdAt: number;
  cancelledAt: number | null;
  event: {
    title: string;
    startsAt: number;
    endsAt: number;
    venue: string;
    locationName: string;
    status: 'draft' | 'published' | 'cancelled';
    /** So workflows can show the start in local time, e.g. "Australia/Perth". */
    timeZone: string;
  };
};

/** What workflows trigger on. A guest who cancelled stays cancelled even if the event is later. */
export const eventBookingStatuses = [
  { value: 'booked', label: 'Booked' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'event_cancelled', label: 'Event cancelled' },
] as const;

/** The custom contact properties the sync writes, created in HubSpot on first use. */
export const HUBSPOT_EVENT_PROPERTIES = [
  { name: 'll_event_name', label: 'Event: name', type: 'string', fieldType: 'text' },
  { name: 'll_event_start', label: 'Event: starts', type: 'datetime', fieldType: 'date' },
  { name: 'll_event_end', label: 'Event: ends', type: 'datetime', fieldType: 'date' },
  { name: 'll_event_time_zone', label: 'Event: time zone', type: 'string', fieldType: 'text' },
  { name: 'll_event_venue', label: 'Event: venue', type: 'string', fieldType: 'text' },
  { name: 'll_event_location', label: 'Event: location', type: 'string', fieldType: 'text' },
  { name: 'll_event_party_size', label: 'Event: people', type: 'number', fieldType: 'number' },
  {
    name: 'll_event_reference',
    label: 'Event: booking reference',
    type: 'string',
    fieldType: 'text',
  },
  {
    name: 'll_event_status',
    label: 'Event: booking status',
    type: 'enumeration',
    fieldType: 'select',
    options: eventBookingStatuses.map((s, i) => ({ ...s, displayOrder: i })),
  },
  // Links for the emails: the ticket's QR code image and adding the event to a calendar.
  {
    name: 'll_event_ticket_qr_url',
    label: 'Event: ticket QR code',
    type: 'string',
    fieldType: 'text',
  },
  {
    name: 'll_event_calendar_url',
    label: 'Event: add to calendar (Apple, Outlook)',
    type: 'string',
    fieldType: 'text',
  },
  {
    name: 'll_event_google_calendar_url',
    label: 'Event: add to Google Calendar',
    type: 'string',
    fieldType: 'text',
  },
] as const;

/**
 * The contact properties for one booking. Empty optional details are left out,
 * not cleared. `cmsOrigin` ("https://cms.example.com") serves the ticket links.
 */
export function hubspotBookingProperties(b: CrmBooking, cmsOrigin: string): Record<string, string> {
  const ticket = {
    reference: b.reference,
    title: b.event.title,
    startsAt: b.event.startsAt,
    endsAt: b.event.endsAt,
    venue: b.event.venue,
    partySize: b.partySize,
  };
  const status =
    b.status === 'cancelled'
      ? 'cancelled'
      : b.event.status === 'cancelled'
        ? 'event_cancelled'
        : 'booked';
  return {
    firstname: b.firstName,
    ...(b.lastName ? { lastname: b.lastName } : {}),
    ...(b.phone ? { phone: b.phone } : {}),
    ll_event_name: b.event.title,
    // HubSpot takes datetimes as epoch milliseconds.
    ll_event_start: String(b.event.startsAt),
    ll_event_end: String(b.event.endsAt),
    ll_event_time_zone: b.event.timeZone,
    ll_event_venue: b.event.venue,
    ll_event_location: b.event.locationName,
    ll_event_party_size: String(b.partySize),
    ll_event_reference: b.reference,
    ll_event_status: status,
    ll_event_ticket_qr_url: `${cmsOrigin}${ticketQrPath(b.reference)}`,
    ll_event_calendar_url: `${cmsOrigin}${ticketCalendarPath(b.reference)}`,
    ll_event_google_calendar_url: googleCalendarUrl(ticket),
  };
}

/**
 * One booking per email address, the most recently changed, since a batch
 * may not name a contact twice and a contact holds one booking.
 */
export function latestPerEmail<T extends Pick<CrmBooking, 'email' | 'createdAt' | 'cancelledAt'>>(
  bookings: T[]
): T[] {
  const changed = (b: T) => b.cancelledAt ?? b.createdAt;
  const latest = new Map<string, T>();
  for (const b of bookings) {
    const key = b.email.trim().toLowerCase();
    const current = latest.get(key);
    if (!current || changed(b) > changed(current)) latest.set(key, b);
  }
  return [...latest.values()];
}

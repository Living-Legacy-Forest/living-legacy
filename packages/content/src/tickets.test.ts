import { describe, expect, it } from 'vitest';
import { eventIcs, googleCalendarUrl, parseTicketCode } from './tickets';

const ticket = {
  reference: 'LL-7K3QXM',
  title: 'Open day, Wellington Dam',
  startsAt: Date.UTC(2026, 10, 18, 2, 30),
  endsAt: Date.UTC(2026, 10, 18, 4, 30),
  venue: '1 Wellington Dam Road, Worsley WA 6225',
  partySize: 2,
};

describe('parseTicketCode', () => {
  it('reads a reference however it was scanned or typed', () => {
    expect(parseTicketCode('LL-7K3QXM')).toBe('LL-7K3QXM');
    expect(parseTicketCode('  ll-7k3qxm\n')).toBe('LL-7K3QXM');
    expect(parseTicketCode('Ticket LL-7K3QXM for 2')).toBe('LL-7K3QXM');
  });

  it('refuses anything that is not a reference', () => {
    expect(parseTicketCode('')).toBeNull();
    expect(parseTicketCode('LL-7K3QX')).toBeNull();
    // 0, 1, I, L and O are never in a reference.
    expect(parseTicketCode('LL-7K3QX0')).toBeNull();
    expect(parseTicketCode('https://example.com/')).toBeNull();
  });
});

describe('googleCalendarUrl', () => {
  it('fills in the title, UTC times, place and reference', () => {
    const url = new URL(googleCalendarUrl(ticket));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Open day, Wellington Dam');
    expect(url.searchParams.get('dates')).toBe('20261118T023000Z/20261118T043000Z');
    expect(url.searchParams.get('location')).toBe(ticket.venue);
    expect(url.searchParams.get('details')).toBe('Booking reference LL-7K3QXM, for 2 people.');
  });

  it('leaves the place out when there is none', () => {
    expect(new URL(googleCalendarUrl({ ...ticket, venue: '' })).searchParams.has('location')).toBe(
      false
    );
  });
});

describe('eventIcs', () => {
  const ics = eventIcs(ticket, Date.UTC(2026, 10, 12));

  it('is one event with UTC times and a stable id per booking', () => {
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('UID:LL-7K3QXM@livinglegacy.com.au');
    expect(lines).toContain('DTSTART:20261118T023000Z');
    expect(lines).toContain('DTEND:20261118T043000Z');
    expect(lines).toContain('DTSTAMP:20261112T000000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes commas and semicolons in text', () => {
    expect(ics).toContain('SUMMARY:Open day\\, Wellington Dam');
    expect(eventIcs({ ...ticket, title: 'A; B' })).toContain('SUMMARY:A\\; B');
  });

  it('folds long lines at 75 octets', () => {
    const long = eventIcs({ ...ticket, venue: 'x'.repeat(200) });
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(long).toContain('\r\n x');
  });
});

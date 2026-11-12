// A booking as a ticket: the QR code on it, the links that add the event to a
// calendar, and reading a scanned code back into a booking reference. The CMS
// serves the images and calendar files; HubSpot puts the links in its emails.
import { REFERENCE_ALPHABET } from './events';

/** The QR code holds the reference alone, so staff can type it when a screen won't scan. */
const CODE_PATTERN = new RegExp(`\\bLL-[${REFERENCE_ALPHABET}]{6}\\b`);

/** "ll-7k3qxm " or a longer scanned string → "LL-7K3QXM"; null when there is no reference in it. */
export function parseTicketCode(text: string): string | null {
  return CODE_PATTERN.exec(text.trim().toUpperCase())?.[0] ?? null;
}

/** Paths on the CMS, public: they reveal only what the reference already does. */
export const ticketQrPath = (reference: string) => `/api/tickets/${reference}/qr`;
export const ticketCalendarPath = (reference: string) => `/api/tickets/${reference}/calendar`;

export type TicketEvent = {
  reference: string;
  title: string;
  startsAt: number;
  endsAt: number;
  venue: string;
  partySize: number;
};

/** "20261118T023000Z": UTC, which every calendar converts to the reader's own time. */
function utcStamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function details(t: TicketEvent): string {
  const people = t.partySize === 1 ? '1 person' : `${t.partySize} people`;
  return `Booking reference ${t.reference}, for ${people}.`;
}

/** Opens Google Calendar with the event filled in. */
export function googleCalendarUrl(t: TicketEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: t.title,
    dates: `${utcStamp(t.startsAt)}/${utcStamp(t.endsAt)}`,
    details: details(t),
  });
  if (t.venue) params.set('location', t.venue);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Text values escape backslashes, semicolons, commas and line breaks (RFC 5545). */
const icsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const width = new TextEncoder().encode(char).length;
    if (size + width > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += width;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** A calendar file (.ics) with the one event, for Apple Calendar, Outlook and the rest. */
export function eventIcs(t: TicketEvent, now = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Living Legacy//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable per booking, so adding it twice updates the one entry.
    `UID:${t.reference}@livinglegacy.com.au`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(t.startsAt)}`,
    `DTEND:${utcStamp(t.endsAt)}`,
    `SUMMARY:${icsText(t.title)}`,
    ...(t.venue ? [`LOCATION:${icsText(t.venue)}`] : []),
    `DESCRIPTION:${icsText(details(t))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

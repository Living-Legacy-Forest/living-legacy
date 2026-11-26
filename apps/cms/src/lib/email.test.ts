import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { type BookingConfirmation, bookingConfirmationEmail, layout } from './email';

beforeAll(() => {
  (env as unknown as Record<string, string>).BETTER_AUTH_URL = 'https://cms.example.com/some/path';
});

const base = {
  preheader: 'Preview text',
  heading: 'Sign in to the CMS',
  intro: ['Use the button below.'],
  button: { label: 'Sign in', url: 'https://cms.example.com/verify?token=a&next=b' },
};

describe('email layout', () => {
  it('puts the heading above the card and the button inside it', () => {
    const html = layout(base);
    const heading = html.indexOf('<h1');
    const card = html.indexOf('border-radius:12px');
    const button = html.indexOf('>Sign in</a>');
    expect(heading).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(heading);
    expect(button).toBeGreaterThan(card);
  });

  it('always loads the logo from the live CMS, so it shows in development and on previews', () => {
    const html = layout(base);
    expect(html).toContain('src="https://cms.livinglegacy.com.au/email/logo-mark.png"');
    expect(html).not.toContain('cms.example.com/email');
  });

  it('draws the button like the CMS button: a gradient, a rim and a top highlight', () => {
    const html = layout(base);
    expect(html).toContain('linear-gradient(to bottom,#4c6252,#2c4633)');
    expect(html).toContain('border:1px solid #283f2e');
    expect(html).toContain('inset 0 1px 0 #6b7e70');
  });

  it('escapes the heading, the preview text and the link, but not the intro HTML', () => {
    const html = layout({
      ...base,
      preheader: 'a <b> & c',
      heading: 'Hello <script>',
      intro: ['<strong>bold</strong>'],
    });
    expect(html).toContain('Hello &lt;script&gt;');
    expect(html).toContain('a &lt;b&gt; &amp; c');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toContain('<script>');
    // The address is escaped in both the button and the fallback line.
    expect(html.split('token=a&amp;next=b').length - 1).toBe(3);
  });

  it('puts the note in a strip along the foot of the card, after the button', () => {
    const html = layout({ ...base, note: 'If this was not you, ignore it.' });
    const strip = html.indexOf('border-top:1px solid');
    expect(strip).toBeGreaterThan(html.indexOf('>Sign in</a>'));
    expect(html.indexOf('If this was not you, ignore it.')).toBeGreaterThan(strip);
  });

  it('has no strip without a note', () => {
    expect(layout(base)).not.toContain('border-top:1px solid');
  });
});

const confirmation: BookingConfirmation = {
  firstName: 'Alex',
  reference: 'LL-7K2M9Q',
  partySize: 2,
  title: 'Open day',
  startsAt: Date.UTC(2027, 0, 20, 23, 0),
  endsAt: Date.UTC(2027, 0, 21, 1, 0),
  timeZone: 'Australia/Melbourne',
  venue: 'The forest gate',
  manageUrl: 'https://livinglegacy.com.au/events/manage/?ref=LL-7K2M9Q&token=abc',
  calendarUrl: 'https://cms.example.com/api/tickets/LL-7K2M9Q/calendar',
  qrUrl: 'https://cms.example.com/api/tickets/LL-7K2M9Q/qr',
};

describe('booking confirmation email', () => {
  it('names the event in the subject', () => {
    expect(bookingConfirmationEmail(confirmation).subject).toBe("You're booked: Open day");
  });

  it('puts the reference, party, venue and both links in the text', () => {
    const { text } = bookingConfirmationEmail(confirmation);
    expect(text).toContain('LL-7K2M9Q');
    expect(text).toContain('2 people');
    expect(text).toContain('The forest gate');
    expect(text).toContain(confirmation.calendarUrl);
    expect(text).toContain(confirmation.manageUrl);
  });

  it('says "1 person" for a party of one', () => {
    const { text } = bookingConfirmationEmail({ ...confirmation, partySize: 1 });
    expect(text).toContain('1 person');
    expect(text).not.toContain('1 people');
  });

  it("shows the time in the event's own zone and names it", () => {
    const { text } = bookingConfirmationEmail({
      ...confirmation,
      timeZone: 'Australia/Perth',
      startsAt: Date.UTC(2027, 0, 20, 2, 0),
    });
    expect(text).toContain('10:00');
    expect(text).toContain('AWST');
    expect(text).toContain('Perth time');
  });

  it('leaves the venue line out when the event has none', () => {
    const { text } = bookingConfirmationEmail({ ...confirmation, venue: '' });
    expect(text).not.toContain('Where:');
  });

  it('shows the ticket code and the button to manage the booking in the html', () => {
    const { html } = bookingConfirmationEmail(confirmation);
    expect(html).toMatch(/<img[^>]*src="https:\/\/cms\.example\.com\/api\/tickets\/LL-7K2M9Q\/qr"/);
    expect(html).toContain('alt="Your ticket code"');
    expect(html).toContain('See or cancel your booking');
    expect(html).toContain('token=abc');
  });

  it('escapes what a guest or an editor typed', () => {
    const { html } = bookingConfirmationEmail({
      ...confirmation,
      firstName: '<b>Al</b>',
      title: 'Open <day>',
      venue: 'Gate & <yard>',
    });
    expect(html).not.toContain('<b>Al</b>');
    expect(html).toContain('&lt;b&gt;Al&lt;/b&gt;');
    expect(html).toContain('Open &lt;day&gt;');
    expect(html).toContain('Gate &amp; &lt;yard&gt;');
  });
});

import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BookingConfirmation,
  emailConfigured,
  sendBookingConfirmationEmail,
  sendInviteEmail,
} from './email';

const mutableEnv = env as unknown as Record<string, unknown>;
const invite = () => sendInviteEmail('a@example.test', 'https://cms.example.test/login', 'editor');

describe('email delivery', () => {
  const sent: unknown[] = [];

  beforeEach(() => {
    sent.length = 0;
    Object.assign(mutableEnv, {
      EMAIL_FROM: 'Living Legacy CMS <cms@notify.example.test>',
      EMAIL: {
        send: async (message: unknown) => {
          sent.push(message);
          return { messageId: 'id' };
        },
      },
    });
    // Vitest runs as dev, which only prints the link; these tests are about a deployed Worker.
    vi.stubEnv('DEV', false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends through the Cloudflare binding with the sender and the content', async () => {
    await invite();

    expect(sent).toEqual([
      expect.objectContaining({
        from: 'Living Legacy CMS <cms@notify.example.test>',
        to: 'a@example.test',
        subject: 'You have been invited to Living Legacy',
        html: expect.stringContaining('Accept invitation'),
        text: expect.stringContaining('https://cms.example.test/login'),
      }),
    ]);
  });

  it('sends guest confirmations from the guest-facing sender, and CMS mail from the CMS one', async () => {
    mutableEnv.BOOKING_EMAIL_FROM = 'Living Legacy <events@notify.example.test>';
    const confirmation: BookingConfirmation = {
      firstName: 'Sam',
      reference: 'LL-ABC123',
      partySize: 2,
      title: 'Open day',
      startsAt: Date.UTC(2027, 0, 20, 2),
      endsAt: Date.UTC(2027, 0, 20, 4),
      timeZone: 'Australia/Perth',
      venue: 'The forest gate',
      manageUrl: 'https://example.test/events/manage/?ref=LL-ABC123&token=t',
      calendarUrl: 'https://example.test/events/open-day.ics',
      qrUrl: 'https://example.test/qr.png',
    };

    await sendBookingConfirmationEmail('sam@example.test', confirmation);
    await invite();

    expect(sent).toEqual([
      expect.objectContaining({
        from: 'Living Legacy <events@notify.example.test>',
        to: 'sam@example.test',
      }),
      expect.objectContaining({
        from: 'Living Legacy CMS <cms@notify.example.test>',
        to: 'a@example.test',
      }),
    ]);
  });

  it('turns a binding failure into a short message that leaves out the reason', async () => {
    mutableEnv.EMAIL = {
      send: async () => {
        throw Object.assign(new Error('domain not onboarded for a@example.test'), {
          code: 'E_SENDER_NOT_VERIFIED',
        });
      },
    };

    const result = invite();

    await expect(result).rejects.toThrow('Cloudflare Email Service failed (E_SENDER_NOT_VERIFIED)');
    await expect(result).rejects.not.toThrow(/a@example\.test/);
  });

  it('sends a booking confirmation with a reply-to only when one is given', async () => {
    mutableEnv.BOOKING_EMAIL_FROM = 'Living Legacy <events@notify.example.test>';
    const confirmation: BookingConfirmation = {
      firstName: 'Sam',
      reference: 'LL-ABC123',
      partySize: 1,
      title: 'Open day',
      startsAt: Date.UTC(2027, 0, 20, 2),
      endsAt: Date.UTC(2027, 0, 20, 4),
      timeZone: 'Australia/Perth',
      venue: '',
      manageUrl: 'https://example.test/events/manage/?ref=LL-ABC123&token=t',
      calendarUrl: 'https://example.test/events/open-day.ics',
      qrUrl: 'https://example.test/qr.png',
    };

    await sendBookingConfirmationEmail('sam@example.test', confirmation);
    await sendBookingConfirmationEmail('sam@example.test', confirmation, 'events@example.test');

    expect(sent[0]).not.toHaveProperty('replyTo');
    expect(sent[1]).toEqual(expect.objectContaining({ replyTo: 'events@example.test' }));
  });

  it('fails closed when there is no binding, rather than logging the link', async () => {
    mutableEnv.EMAIL = undefined;

    await expect(invite()).rejects.toThrow('Email delivery is not configured');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('prints the link instead of sending in local dev', async () => {
    vi.stubEnv('DEV', true);

    await invite();

    expect(sent).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('reports whether the binding is there', () => {
    expect(emailConfigured()).toBe(true);
    mutableEnv.EMAIL = undefined;
    expect(emailConfigured()).toBe(false);
  });
});

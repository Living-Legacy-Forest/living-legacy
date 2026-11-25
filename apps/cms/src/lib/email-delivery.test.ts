import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailConfigured, sendInviteEmail } from './email';

type Mutable = Record<string, unknown>;
const mutableEnv = env as unknown as Mutable;

describe('email delivery', () => {
  const sent: unknown[] = [];

  beforeEach(() => {
    sent.length = 0;
    Object.assign(mutableEnv, {
      EMAIL_FROM: 'Living Legacy CMS <cms@notify.example.test>',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'test-key',
      EMAIL: {
        send: async (message: unknown) => {
          sent.push(message);
          return { messageId: 'id' };
        },
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends through Resend unless the provider is switched', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await sendInviteEmail('a@example.test', 'https://cms.example.test/login', 'editor');

    expect(fetcher).toHaveBeenCalledOnce();
    expect(sent).toHaveLength(0);
  });

  it('keeps Resend for a misspelt provider rather than failing sign-in', async () => {
    mutableEnv.EMAIL_PROVIDER = 'cloudfare';
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await sendInviteEmail('a@example.test', 'https://cms.example.test/login', 'editor');

    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('sends through the Cloudflare binding with the same sender and content', async () => {
    mutableEnv.EMAIL_PROVIDER = 'cloudflare';
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await sendInviteEmail('a@example.test', 'https://cms.example.test/login', 'editor');

    expect(fetcher).not.toHaveBeenCalled();
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

  it('turns a binding failure into a short message that leaves out the reason', async () => {
    mutableEnv.EMAIL_PROVIDER = 'cloudflare';
    mutableEnv.EMAIL = {
      send: async () => {
        throw Object.assign(new Error('domain not onboarded for a@example.test'), {
          code: 'E_SENDER_NOT_VERIFIED',
        });
      },
    };

    const result = sendInviteEmail('a@example.test', 'https://cms.example.test/login', 'editor');

    await expect(result).rejects.toThrow('Cloudflare Email Service failed (E_SENDER_NOT_VERIFIED)');
    await expect(result).rejects.not.toThrow(/a@example\.test/);
  });

  it('fails closed in a deployed Worker when the chosen provider has nothing to send with', async () => {
    mutableEnv.RESEND_API_KEY = undefined;
    // Vitest runs as dev, which only prints the link; a deployed Worker must refuse.
    vi.stubEnv('DEV', false);

    await expect(
      sendInviteEmail('a@example.test', 'https://cms.example.test/login', 'editor')
    ).rejects.toThrow('Email delivery is not configured');
  });

  it('reports whether the chosen provider can send', () => {
    expect(emailConfigured()).toBe(true);
    mutableEnv.RESEND_API_KEY = undefined;
    expect(emailConfigured()).toBe(false);
    mutableEnv.EMAIL_PROVIDER = 'cloudflare';
    expect(emailConfigured()).toBe(true);
    mutableEnv.EMAIL = undefined;
    expect(emailConfigured()).toBe(false);
  });
});

import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailConfigured, sendInviteEmail } from './email';

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

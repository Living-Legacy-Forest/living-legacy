import { env } from 'cloudflare:workers';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function send(email: Email): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Fail closed in a deployed Worker: a missing key must never cause a live
    // sign-in link to be written to logs. Only local dev prints it, so the
    // flow stays testable without sending anything.
    if (!import.meta.env.DEV) {
      throw new Error('Email delivery is not configured');
    }
    console.warn(
      `[email] dev mode, no RESEND_API_KEY; link not sent to ${email.to}:\n${email.text}`
    );
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...email }),
  });

  if (!res.ok) {
    // Log Resend's reason (domain not verified, etc.) for diagnosis; keep it out
    // of the thrown message, which surfaces to the client.
    console.error(`[email] Resend ${res.status}: ${await res.text()}`);
    throw new Error(`Resend returned ${res.status}`);
  }
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const subject = 'Your sign-in link for Living Legacy Forest';
  const text = [
    'Sign in to the Living Legacy Forest CMS with this link:',
    '',
    url,
    '',
    'It expires in 5 minutes and can be used once. If you did not request it,',
    'you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Sign in to Living Legacy Forest</h1>
      <p style="margin: 0 0 24px;">Use the button below to sign in to the CMS.</p>
      <p style="margin: 0 0 24px;">
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px;">Sign in</a>
      </p>
      <p style="font-size: 13px; color: #666; margin: 0;">
        This link expires in 5 minutes and can be used once. If you did not
        request it, you can ignore this email.
      </p>
    </div>
  `;

  await send({ to, subject, html, text });
}

export async function sendInviteEmail(to: string, loginUrl: string): Promise<void> {
  const subject = 'You have been invited to Living Legacy Forest';
  const text = [
    'You have been invited to the Living Legacy Forest CMS.',
    '',
    `Go to ${loginUrl} and sign in with this email (${to}) to get started.`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">You're invited to Living Legacy Forest</h1>
      <p style="margin: 0 0 24px;">You've been invited to help manage the website content. Sign in with this email (${to}) to get started.</p>
      <p style="margin: 0 0 24px;">
        <a href="${loginUrl}" style="display: inline-block; background: #2c4633; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px;">Go to the CMS</a>
      </p>
      <p style="font-size: 13px; color: #666; margin: 0;">
        If you weren't expecting this, you can ignore this email.
      </p>
    </div>
  `;

  await send({ to, subject, html, text });
}

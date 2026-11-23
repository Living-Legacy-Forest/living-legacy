import type { Role } from '@ll/content';
import { env } from 'cloudflare:workers';
import { formatDateTime, zoneName } from './format';
import { readSiteSettings } from './site-settings';

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

// Brand colours from the website (apps/web global.css).
const colours = {
  ink: '#17231c',
  inkSoft: '#4b5b51',
  moss: '#2c4633',
  // The CMS's raised button, mixed from the green: lit at the top, a bright edge, a darker rim.
  mossTop: '#4c6252',
  mossHighlight: '#6b7e70',
  mossEdge: '#283f2e',
  // Tints the note strip along the foot of the card; the page itself is white.
  paper: '#f6f2e9',
  line: '#e4dccb',
  white: '#ffffff',
};

const SITE_URL = 'https://livinglegacy.com.au';
// Always the live CMS's copy, never the running one's: a mail app cannot reach localhost, so in
// development, or on a preview, the logo would show as a broken image. It is a static asset.
const LOGO_URL = 'https://cms.livinglegacy.com.au/email/logo-mark.png';
const LEGAL_LINE = 'Forest Conservation Australia Pty Ltd · ABN 59 639 330 617';
const serif = "Georgia, 'Times New Roman', serif";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The CMS's own address, where the email logo is served from (public/email). */
export const cmsOrigin = () => new URL(env.BETTER_AUTH_URL).origin;

/**
 * One branded layout for every CMS email: the logo and heading centred above a card that holds
 * the message and button, with the note as a strip along its foot. Tables and inline styles, because
 * Outlook and Gmail ignore most modern CSS. `preheader`, `heading` and
 * `button.url` are plain text and escaped here; `intro` is HTML, so callers
 * escape what they put in it.
 */
export function layout(opts: {
  /** Inbox preview text, shown after the subject and hidden in the email. */
  preheader: string;
  heading: string;
  /** Paragraphs of HTML above the button. */
  intro: string[];
  button: { label: string; url: string };
  /** HTML shown in a tinted strip along the bottom of the card, e.g. a security note. */
  note?: string;
}) {
  const url = escapeHtml(opts.button.url);
  const paragraphs = opts.intro
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${sans};font-size:15px;line-height:24px;color:${colours.inkSoft};">${p}</p>`
    )
    .join('');
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${colours.white};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colours.white};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:0 0 28px;">
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <!-- The mark is white, so it sits on a green tile. -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background:${colours.moss};border-radius:10px;padding:7px;">
                        <img src="${LOGO_URL}" width="30" height="30" alt="Living Legacy" style="display:block;border:0;">
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align:middle;font-family:${serif};font-size:20px;"><a href="${SITE_URL}" style="color:${colours.ink};text-decoration:none;">Living Legacy</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 8px 28px;">
            <h1 style="margin:0;font-family:${serif};font-size:30px;line-height:38px;font-weight:normal;text-align:center;color:${colours.ink};">${escapeHtml(opts.heading)}</h1>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;background:${colours.white};border:1px solid ${colours.line};border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:36px 36px 32px;">
                  ${paragraphs}
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                    <tr>
                      <td style="border-radius:8px;background:${colours.moss};">
                        <a href="${url}" style="display:inline-block;padding:8px 20px;font-family:${sans};font-size:14px;line-height:20px;font-weight:500;color:${colours.white};text-decoration:none;background-color:${colours.moss};background-image:linear-gradient(to bottom,${colours.mossTop},${colours.moss});border:1px solid ${colours.mossEdge};border-radius:8px;box-shadow:inset 0 1px 0 ${colours.mossHighlight},0 1px 2px rgba(0,0,0,0.05);">${opts.button.label}</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 6px;font-family:${sans};font-size:13px;line-height:20px;color:${colours.inkSoft};">Or copy this link:</p>
                  <p style="margin:0;font-family:${sans};font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" style="color:${colours.moss};">${url}</a></p>
                </td>
              </tr>${
                opts.note
                  ? `
              <tr>
                <td style="background:${colours.paper};border-top:1px solid ${colours.line};padding:20px 36px;font-family:${sans};font-size:13px;line-height:20px;color:${colours.inkSoft};">${opts.note}</td>
              </tr>`
                  : ''
              }
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:32px 8px 0;font-family:${sans};font-size:12px;line-height:19px;color:${colours.inkSoft};text-align:center;">
            <p style="margin:0 0 4px;">${LEGAL_LINE}</p>
            <p style="margin:0;">Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const textFooter = ['', '--', LEGAL_LINE, 'Please do not reply to this email.'];

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const subject = 'Your sign-in link for Living Legacy';
  const { timeZone } = await readSiteSettings();
  const now = Date.now();
  const requested = `${formatDateTime(now, timeZone)} (${zoneName(timeZone, now)})`;
  const text = [
    'Sign in to Living Legacy with this link:',
    '',
    url,
    '',
    'It works once and expires in 5 minutes.',
    '',
    `Requested for ${to} on ${requested}. If this was not you, ignore this email.`,
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: 'Your sign-in link. It works once and expires in 5 minutes.',
    heading: 'Sign in to the CMS',
    intro: ['This link works once and expires in 5 minutes.'],
    button: { label: 'Sign in', url },
    note: `Requested for <strong style="color:${colours.ink};">${escapeHtml(to)}</strong> on ${escapeHtml(requested)}. If this was not you, ignore this email.`,
  });

  await send({ to, subject, html, text });
}

const roleNames: Record<Role, string> = {
  admin: 'an Admin',
  editor: 'an Editor',
  author: 'an Author',
  seo: 'an SEO editor',
  viewer: 'a Viewer',
};

export async function sendReviewRequestedEmail(
  to: string,
  opts: { postTitle: string; authorName: string; postUrl: string }
): Promise<void> {
  const subject = `${opts.authorName} submitted "${opts.postTitle}" for review`;
  const text = [
    `${opts.authorName} submitted "${opts.postTitle}" for review on Living Legacy.`,
    '',
    `Open it here: ${opts.postUrl}`,
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: `${opts.authorName} submitted a post for review.`,
    heading: 'A post is ready for review',
    intro: [
      `<strong style="color:${colours.ink};">${escapeHtml(opts.authorName)}</strong> submitted <strong style="color:${colours.ink};">${escapeHtml(opts.postTitle)}</strong> for review.`,
    ],
    button: { label: 'Review the post', url: opts.postUrl },
  });

  await send({ to, subject, html, text });
}

export async function sendChangeEmailVerificationEmail(to: string, url: string): Promise<void> {
  const subject = 'Confirm your new email for Living Legacy';
  const text = [
    `Someone requested changing a Living Legacy CMS account's email to ${to}.`,
    '',
    `Confirm it with this link: ${url}`,
    '',
    'If this was not you, ignore this email. Nothing changes until you confirm.',
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: 'Confirm this email change to the Living Legacy CMS.',
    heading: 'Confirm your new email',
    intro: [
      `Confirm <strong style="color:${colours.ink};">${escapeHtml(to)}</strong> as your sign-in email.`,
    ],
    button: { label: 'Confirm email', url },
    note: 'If this was not you, ignore this email. Nothing changes until you confirm.',
  });

  await send({ to, subject, html, text });
}

export async function sendInviteEmail(to: string, loginUrl: string, role: Role): Promise<void> {
  const subject = 'You have been invited to Living Legacy';
  const text = [
    `You have been invited to the Living Legacy CMS as ${roleNames[role]}.`,
    '',
    `Go to ${loginUrl} and sign in with this email (${to}) to get started.`,
    '',
    'If you were not expecting this invitation, ignore this email.',
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: 'You have been invited to help manage the Living Legacy website.',
    heading: 'You are invited',
    intro: [
      `You have been given access as ${roleNames[role]}. Sign in with <strong style="color:${colours.ink};">${escapeHtml(to)}</strong>. There is no password: we email you a sign-in link each time.`,
    ],
    button: { label: 'Accept invitation', url: loginUrl },
    note: 'If you were not expecting this, ignore this email. Nothing happens until you sign in.',
  });

  await send({ to, subject, html, text });
}

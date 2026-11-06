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
  /** Defaults to EMAIL_FROM (the CMS sender). */
  from?: string;
  replyTo?: string;
  /** Base64 content, e.g. an .ics file. */
  attachments?: { filename: string; content: string }[];
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
    body: JSON.stringify({
      from: email.from ?? env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.attachments ? { attachments: email.attachments } : {}),
    }),
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
  paper: '#f6f2e9',
  line: '#e4dccb',
  white: '#ffffff',
};

const SITE_URL = 'https://livinglegacy.com.au';
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
 * One branded layout for every CMS email. Tables and inline styles, because
 * Outlook and Gmail ignore most modern CSS. All text passed in must already
 * be escaped; `button.url` is escaped here.
 */
function layout(opts: {
  /** Inbox preview text, shown after the subject and hidden in the email. */
  preheader: string;
  heading: string;
  /** Paragraphs of HTML above the button. */
  intro: string[];
  /** The one call to action; emails without one show none. */
  button?: { label: string; url: string };
  /** HTML shown in a soft panel below the button, e.g. a security note. */
  note?: string;
}) {
  const url = opts.button ? escapeHtml(opts.button.url) : '';
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
<title>${opts.heading}</title>
</head>
<body style="margin:0;padding:0;background:${colours.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colours.paper};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 4px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <!-- The mark is white, so it sits on a green tile. -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background:${colours.moss};border-radius:10px;padding:8px 7px;">
                        <img src="${cmsOrigin()}/email/logo-mark.png" width="30" height="25" alt="Living Legacy" style="display:block;border:0;">
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align:middle;font-family:${serif};font-size:18px;color:${colours.ink};">Living Legacy</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:${colours.white};border:1px solid ${colours.line};border-radius:12px;padding:40px 36px;">
            <h1 style="margin:0 0 16px;font-family:${serif};font-size:26px;line-height:32px;font-weight:normal;color:${colours.ink};">${opts.heading}</h1>
            ${paragraphs}
            ${
              opts.button
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
              <tr>
                <td style="border-radius:8px;background:${colours.moss};">
                  <a href="${url}" style="display:inline-block;padding:13px 28px;font-family:${sans};font-size:15px;font-weight:600;color:${colours.white};text-decoration:none;border-radius:8px;">${opts.button.label}</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-family:${sans};font-size:13px;line-height:20px;color:${colours.inkSoft};">If the button does not work, copy this link into your browser:</p>
            <p style="margin:0;font-family:${sans};font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" style="color:${colours.moss};">${url}</a></p>`
                : ''
            }
            ${
              opts.note
                ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
              <tr>
                <td style="background:${colours.paper};border-radius:8px;padding:14px 16px;font-family:${sans};font-size:13px;line-height:20px;color:${colours.inkSoft};">${opts.note}</td>
              </tr>
            </table>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0;font-family:${sans};font-size:12px;line-height:19px;color:${colours.inkSoft};">
            <p style="margin:0 0 4px;"><a href="${SITE_URL}" style="color:${colours.ink};text-decoration:none;font-weight:600;">Living Legacy</a></p>
            <p style="margin:0 0 4px;">${LEGAL_LINE}</p>
            <p style="margin:0;">Sent by the Living Legacy content system. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const textFooter = [
  '',
  '--',
  'Living Legacy',
  LEGAL_LINE,
  SITE_URL,
  'Sent by the Living Legacy content system. Please do not reply to this email.',
];

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const subject = 'Your sign-in link for Living Legacy';
  const { timeZone } = await readSiteSettings();
  const now = Date.now();
  const requested = `${formatDateTime(now, timeZone)} (${zoneName(timeZone, now)})`;
  const text = [
    'Sign in to the Living Legacy CMS with this link:',
    '',
    url,
    '',
    'It works once and expires in 5 minutes.',
    '',
    `Requested for ${to} on ${requested}. If this was not you, you can ignore`,
    'this email. No one can sign in without the link.',
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: 'Your sign-in link. It works once and expires in 5 minutes.',
    heading: 'Sign in to the CMS',
    intro: [
      'Use the button below to sign in to the Living Legacy content system. The link works once and expires in 5 minutes.',
    ],
    button: { label: 'Sign in', url },
    note: `Requested for <strong style="color:${colours.ink};">${escapeHtml(to)}</strong> on ${escapeHtml(requested)}. If this was not you, you can ignore this email. No one can sign in without the link.`,
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
    'If this was not you, you can ignore this email. Your email stays unchanged',
    'until this link is used.',
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: 'Confirm this email change to the Living Legacy CMS.',
    heading: 'Confirm your new email',
    intro: [
      `Use the button below to confirm <strong style="color:${colours.ink};">${escapeHtml(to)}</strong> as the sign-in email for a Living Legacy CMS account.`,
    ],
    button: { label: 'Confirm email', url },
    note: 'If this was not you, you can ignore this email. The email stays unchanged until this link is used.',
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
    'If you were not expecting this invitation, you can ignore this email.',
    ...textFooter,
  ].join('\n');

  const html = layout({
    preheader: 'You have been invited to help manage the Living Legacy website.',
    heading: 'You are invited',
    intro: [
      `You have been given access to the Living Legacy content system, where the website is managed, as ${roleNames[role]}.`,
      `Sign in with <strong style="color:${colours.ink};">${escapeHtml(to)}</strong> to get started. There is no password; we email you a sign-in link each time.`,
    ],
    button: { label: 'Accept invitation', url: loginUrl },
    note: 'If you were not expecting this invitation, you can ignore this email. Nothing happens until you sign in.',
  });

  await send({ to, subject, html, text });
}

type BookingMail = {
  firstName: string;
  title: string;
  /** Already formatted in the site time zone, e.g. "Sat 7 Nov 2026, 10:00 am AEDT". */
  when: string;
  venue: string;
  mapUrl: string | null;
  partySize: number;
  reference: string;
  replyTo: string;
};

const eventsFrom = () => env.EVENTS_EMAIL_FROM ?? env.EMAIL_FROM;
const places = (n: number) => (n === 1 ? '1 place' : `${n} places`);
const detailRows = (d: Pick<BookingMail, 'when' | 'venue'>) =>
  [`<strong style="color:${colours.ink};">When:</strong> ${escapeHtml(d.when)}`].concat(
    d.venue ? [`<strong style="color:${colours.ink};">Where:</strong> ${escapeHtml(d.venue)}`] : []
  );

export async function sendBookingConfirmation(
  to: string,
  d: BookingMail & { ics: string }
): Promise<void> {
  const subject = `You're booked: ${d.title}`;
  const text = [
    `Hi ${d.firstName},`,
    '',
    `You're booked for ${d.title}: ${places(d.partySize)}.`,
    `When: ${d.when}`,
    ...(d.venue ? [`Where: ${d.venue}`] : []),
    `Booking reference: ${d.reference}`,
    '',
    'The calendar file attached adds it to your calendar.',
    'Need to cancel or change your booking? Reply to this email and we will sort it out.',
    ...textFooter,
  ].join('\n');
  const html = layout({
    preheader: `Booking ${d.reference} for ${d.title}.`,
    heading: `You're booked, ${escapeHtml(d.firstName)}`,
    intro: [
      `We look forward to seeing you at <strong style="color:${colours.ink};">${escapeHtml(d.title)}</strong>. Your booking is for ${places(d.partySize)}.`,
      ...detailRows(d),
      `<strong style="color:${colours.ink};">Booking reference:</strong> ${escapeHtml(d.reference)}`,
    ],
    button: d.mapUrl ? { label: 'Get directions', url: d.mapUrl } : undefined,
    note: 'The calendar file attached adds the event to your calendar. Need to cancel or change your booking? Reply to this email and we will sort it out.',
  });
  await send({
    to,
    subject,
    html,
    text,
    from: eventsFrom(),
    replyTo: d.replyTo,
    // nodejs_compat is on, so Buffer is available for the base64 Resend wants.
    attachments: [{ filename: 'event.ics', content: Buffer.from(d.ics).toString('base64') }],
  });
}

export async function sendEventReminder(to: string, d: BookingMail): Promise<void> {
  const subject = `Tomorrow: ${d.title}`;
  const text = [
    `Hi ${d.firstName},`,
    '',
    `A reminder that ${d.title} is coming up. Your booking is for ${places(d.partySize)}.`,
    `When: ${d.when}`,
    ...(d.venue ? [`Where: ${d.venue}`] : []),
    `Booking reference: ${d.reference}`,
    '',
    "Can't make it? Reply to this email so we can offer your place to someone else.",
    ...textFooter,
  ].join('\n');
  const html = layout({
    preheader: `${d.title} is coming up.`,
    heading: 'See you soon',
    intro: [
      `A reminder that <strong style="color:${colours.ink};">${escapeHtml(d.title)}</strong> is coming up. Your booking is for ${places(d.partySize)}.`,
      ...detailRows(d),
      `<strong style="color:${colours.ink};">Booking reference:</strong> ${escapeHtml(d.reference)}`,
    ],
    button: d.mapUrl ? { label: 'Get directions', url: d.mapUrl } : undefined,
    note: "Can't make it? Reply to this email so we can offer your place to someone else.",
  });
  await send({ to, subject, html, text, from: eventsFrom(), replyTo: d.replyTo });
}

export async function sendEventCancelled(
  to: string,
  d: Omit<BookingMail, 'reference' | 'partySize'>
): Promise<void> {
  const subject = `Cancelled: ${d.title}`;
  const text = [
    `Hi ${d.firstName},`,
    '',
    `We're sorry, but ${d.title} on ${d.when} has been cancelled, so your booking no longer stands.`,
    'Reply to this email if you have any questions.',
    ...textFooter,
  ].join('\n');
  const html = layout({
    preheader: `${d.title} has been cancelled.`,
    heading: 'This event has been cancelled',
    intro: [
      `Hi ${escapeHtml(d.firstName)}, we're sorry, but <strong style="color:${colours.ink};">${escapeHtml(d.title)}</strong> on ${escapeHtml(d.when)} has been cancelled, so your booking no longer stands.`,
      'Reply to this email if you have any questions.',
    ],
  });
  await send({ to, subject, html, text, from: eventsFrom(), replyTo: d.replyTo });
}

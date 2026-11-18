// Strict checks for what people type into forms, shared by the CMS server and anything else that
// stores it. Each `*Schema` trims first and returns a tidy value (lower-case email, phone in one
// format), so what is saved is the same however it was typed. Messages say what to enter.
import { z } from 'zod';
import { auPhone } from './phone';

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const EMAIL = new RegExp(
  `^[a-z0-9!#$%&'*+/=?^_\`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_\`{|}~-]+)*@${LABEL}(?:\\.${LABEL})*\\.(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$`
);

/**
 * A usable email: one @, a local part without leading, trailing or doubled dots (at most 64
 * characters), and a domain of dotted labels ending in a real-looking top level, 254 in all.
 * No quotes, comments or IP-address domains, which no contact form or sign-in needs.
 */
export function isEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return email.length <= 254 && at > 0 && at <= 64 && EMAIL.test(email);
}

export const EMAIL_MESSAGE = 'Enter an email like name@example.com.';

/** A required email, trimmed and in lower case. */
export const emailSchema = (max = 254) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max, `Use at most ${max} characters.`)
    .refine(isEmail, EMAIL_MESSAGE);

/** An email, or nothing. */
export const optionalEmailSchema = (max = 254) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max, `Use at most ${max} characters.`)
    .refine((v) => v === '' || isEmail(v), EMAIL_MESSAGE)
    .default('');

/**
 * A web address a visitor could open: http or https, a real host (a dotted name with an
 * alphabetic ending, so not "localhost" or "https://x"), no sign-in details in it, no spaces.
 */
export function isWebUrl(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 2000 || /\s/.test(text)) return false;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  return /^(?:[a-z0-9-]+\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})\.?$/i.test(url.hostname);
}

export const WEB_URL_MESSAGE = 'Enter a web address starting with https://.';

/** A required web address. */
export const webUrlSchema = (max = 2000) =>
  z.string().trim().max(max, `Use at most ${max} characters.`).refine(isWebUrl, WEB_URL_MESSAGE);

/** A web address, or nothing. */
export const optionalWebUrlSchema = (max = 300) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .refine((v) => v === '' || isWebUrl(v), WEB_URL_MESSAGE)
    .default('');

/**
 * An Australian number someone could ring a business on, in one format: a mobile or landline
 * (see auPhone) or a 13 / 1300 / 1800 number ("13 12 34", "1300 123 456"). Null if it is none.
 */
export function auContactPhone(text: string): string | null {
  const personal = auPhone(text);
  if (personal) return personal;
  const digits = text.trim().replace(/[\s().-]/g, '');
  if (/^13\d{4}$/.test(digits))
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  if (/^1[38]00\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return null;
}

export const PHONE_MESSAGE =
  'Enter an Australian phone number, like 03 7019 6142, 0412 345 678 or 1300 000 000.';

/** A phone number, or nothing, saved in one format. */
export const optionalPhoneSchema = (max = 40) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .refine((v) => v === '' || auContactPhone(v) !== null, PHONE_MESSAGE)
    .transform((v) => (v === '' ? '' : auContactPhone(v)!))
    .default('');

/** A whole number in a range, with one message that names the field and the range. */
export const wholeNumberSchema = (label: string, min: number, max: number) => {
  const message = `${label} must be a whole number from ${min.toLocaleString('en-AU')} to ${max.toLocaleString('en-AU')}.`;
  return z.number(message).int(message).min(min, message).max(max, message);
};

import { z } from 'zod';
import type { BookableEvent, BookingStatus } from './events';

export type BookingState = 'open' | 'not-yet' | 'closed' | 'full' | 'cancelled';

/**
 * Where a one-person booking from the website stands. It follows the same order of rules as
 * `bookingProblem(event, 1, taken, now, 'website')`: null there is 'open' here, a draft is 'closed'.
 */
export function bookingState(event: BookableEvent, taken: number, now: number): BookingState {
  if (event.status === 'cancelled') return 'cancelled';
  if (event.status !== 'published') return 'closed';
  if (event.bookingsOpenAt !== null && now < event.bookingsOpenAt) return 'not-yet';
  if (now >= (event.bookingsCloseAt ?? event.startsAt)) return 'closed';
  if (event.capacity !== null && event.capacity - taken <= 0) return 'full';
  return 'open';
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The link token for a booking, derived so a retry can rebuild it: only its hash is stored. */
export async function manageToken(secret: string, bookingId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bookingId));
  return base64url(new Uint8Array(signature));
}

/** What is stored in place of a token: SHA-256, lowercase hex. */
export async function hashManageToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Equality that takes as long however early the strings differ, so a guess learns nothing. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function manageUrl(origin: string, reference: string, token: string): string {
  return `${origin}/events/manage/?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;
}

export const internalManageSchema = z.object({
  reference: z.string().max(20),
  token: z.string().min(20).max(100),
});

/** A booking as its own guest sees it on the manage page. */
export type ManagedBooking = {
  reference: string;
  status: BookingStatus;
  firstName: string;
  partySize: number;
  event: {
    title: string;
    slug: string;
    startsAt: number;
    endsAt: number;
    timeZone: string;
    venue: string;
  };
};

/** What the CMS answers the website with: the result on success, a sentence to show on failure. */
export type InternalResult<T> = ({ ok: true } & T) | { ok: false; message: string };

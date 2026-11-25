/**
 * How long a new website booking has to be confirmed before the guest list says it was not. The
 * email goes out as the booking is made, and the cron job retries a failed one every few minutes.
 */
export const CONFIRMATION_GRACE_MS = 10 * 60_000;

/**
 * Whether a guest booked on the website was never sent their confirmation, even though it is
 * overdue. Turning confirmations off on purpose shows this too: it is what staff should check.
 */
export function confirmationMissing(
  guest: {
    status: string;
    source: string;
    email: string;
    confirmationSentAt: number | null;
    createdAt: number;
  },
  now: number
) {
  return (
    guest.status === 'confirmed' &&
    guest.source === 'website' &&
    guest.email !== '' &&
    guest.confirmationSentAt === null &&
    now - guest.createdAt > CONFIRMATION_GRACE_MS
  );
}

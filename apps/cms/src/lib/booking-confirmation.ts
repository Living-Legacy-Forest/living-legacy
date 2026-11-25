/**
 * How long a new website booking has to be confirmed before the guest list says it was not. The
 * email goes out as the booking is made, and the cron job retries a failed one every few minutes.
 */
export const CONFIRMATION_GRACE_MS = 10 * 60_000;

/**
 * Whether a guest booked on the website was never sent their confirmation, even though it is
 * overdue. Only while the CMS sends them: with the switch off (HubSpot sends them instead), none
 * is sent from here, so nothing is flagged.
 */
export function confirmationMissing(
  guest: {
    status: string;
    source: string;
    email: string;
    confirmationSentAt: number | null;
    createdAt: number;
  },
  now: number,
  sending: boolean
) {
  return (
    sending &&
    guest.status === 'confirmed' &&
    guest.source === 'website' &&
    guest.email !== '' &&
    guest.confirmationSentAt === null &&
    now - guest.createdAt > CONFIRMATION_GRACE_MS
  );
}

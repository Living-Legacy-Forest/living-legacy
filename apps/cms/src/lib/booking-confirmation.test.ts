import { describe, expect, it } from 'vitest';
import { CONFIRMATION_GRACE_MS, confirmationMissing } from './booking-confirmation';

const now = Date.parse('2027-01-10T01:00:00Z');
const guest = {
  status: 'confirmed',
  source: 'website',
  email: 'alex@example.com',
  confirmationSentAt: null,
  createdAt: now - CONFIRMATION_GRACE_MS - 1,
};

describe('confirmationMissing', () => {
  it('flags a website booking with an email that was never confirmed', () => {
    expect(confirmationMissing(guest, now)).toBe(true);
  });

  it('gives a new booking ten minutes before flagging it', () => {
    expect(CONFIRMATION_GRACE_MS).toBe(10 * 60_000);
    expect(confirmationMissing({ ...guest, createdAt: now - CONFIRMATION_GRACE_MS }, now)).toBe(
      false
    );
    expect(confirmationMissing({ ...guest, createdAt: now }, now)).toBe(false);
  });

  it('leaves out confirmed ones, staff bookings, no email and other statuses', () => {
    expect(confirmationMissing({ ...guest, confirmationSentAt: now - 1 }, now)).toBe(false);
    expect(confirmationMissing({ ...guest, source: 'staff' }, now)).toBe(false);
    expect(confirmationMissing({ ...guest, email: '' }, now)).toBe(false);
    expect(confirmationMissing({ ...guest, status: 'cancelled' }, now)).toBe(false);
    expect(confirmationMissing({ ...guest, status: 'waitlisted' }, now)).toBe(false);
  });
});

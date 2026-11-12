import { describe, expect, it } from 'vitest';
import { maskEmails } from './redact';

describe('maskEmails', () => {
  it('keeps the first letter and the domain of each address', () => {
    expect(maskEmails('Booking for jo.tester@example.com.au failed')).toBe(
      'Booking for j***@example.com.au failed'
    );
    expect(maskEmails('a@b.co and Sam+events@mail.example.org')).toBe(
      'a***@b.co and S***@mail.example.org'
    );
  });

  it('leaves text without addresses alone', () => {
    expect(maskEmails('HubSpot 429 Too Many Requests')).toBe('HubSpot 429 Too Many Requests');
    expect(maskEmails('user@localhost')).toBe('user@localhost');
  });
});

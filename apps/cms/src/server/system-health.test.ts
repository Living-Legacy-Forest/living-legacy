import { describe, expect, it } from 'vitest';
import {
  judgeDatabase,
  judgeEmail,
  judgeHubspot,
  judgeStorage,
  judgeWebsite,
} from './system-health';

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const hours = (n: number) => n * 3_600_000;
const now = Date.parse('2027-01-20T09:00:00Z');

describe('judgeDatabase', () => {
  it('is ok when it answers quickly and has room', () => {
    expect(judgeDatabase({ ms: 12, bytes: 42 * MB })).toEqual({
      status: 'ok',
      detail: 'Answered in 12 ms. 42 MB used of 10 GB.',
    });
  });

  it('is a warning when slow or 80% full, and a problem at 95%', () => {
    expect(judgeDatabase({ ms: 1500, bytes: 42 * MB }).status).toBe('warning');
    expect(judgeDatabase({ ms: 12, bytes: 8.1 * GB })).toEqual({
      status: 'warning',
      detail: 'Answered in 12 ms. 8.1 GB used of 10 GB, close to the limit.',
    });
    expect(judgeDatabase({ ms: 12, bytes: 9.6 * GB }).status).toBe('problem');
  });

  it('is a problem when it does not answer', () => {
    expect(judgeDatabase({ error: 'D1_ERROR: timed out' })).toEqual({
      status: 'problem',
      detail: 'Did not answer: D1_ERROR: timed out',
    });
  });
});

describe('judgeStorage', () => {
  it('is ok, slow or unreachable', () => {
    expect(judgeStorage({ ms: 30 })).toEqual({ status: 'ok', detail: 'Answered in 30 ms.' });
    expect(judgeStorage({ ms: 2500 })).toEqual({
      status: 'warning',
      detail: 'Answered, but slowly: 2,500 ms.',
    });
    expect(judgeStorage({ error: 'R2 down' })).toEqual({
      status: 'problem',
      detail: 'Could not list files: R2 down',
    });
  });
});

describe('judgeWebsite', () => {
  it('is ok when the home page loads', () => {
    expect(judgeWebsite({ status: 200, ms: 340 })).toEqual({
      status: 'ok',
      detail: 'The home page loaded in 340 ms.',
    });
  });

  it('is a warning when it loads slowly', () => {
    expect(judgeWebsite({ status: 200, ms: 3500 })).toEqual({
      status: 'warning',
      detail: 'The home page loaded, but slowly: 3,500 ms.',
    });
  });

  it('is a problem for any other answer, or none', () => {
    expect(judgeWebsite({ status: 503, ms: 90 })).toEqual({
      status: 'problem',
      detail: 'The home page answered 503 instead of loading.',
    });
    expect(judgeWebsite({ error: 'timeout' })).toEqual({
      status: 'problem',
      detail: 'The home page did not load within 5 seconds.',
    });
  });
});

describe('judgeHubspot', () => {
  it('is a warning when HubSpot is not connected', () => {
    expect(judgeHubspot({ connected: false }, now)).toEqual({
      status: 'warning',
      detail: 'Not connected. Bookings stay in the CMS until it is.',
    });
  });

  it('is ok with nothing waiting, or nothing waiting long', () => {
    expect(judgeHubspot({ connected: true, waiting: 0 }, now)).toEqual({
      status: 'ok',
      detail: 'Every booking has been sent.',
    });
    expect(
      judgeHubspot({ connected: true, waiting: 2, oldestAt: now - hours(0.5) }, now)
    ).toMatchObject({ status: 'ok', detail: '2 bookings waiting for the next send.' });
  });

  it('is a warning after an hour waiting and a problem after six, with the last error', () => {
    expect(
      judgeHubspot(
        { connected: true, waiting: 1, oldestAt: now - hours(3), lastError: 'HubSpot 401' },
        now
      )
    ).toEqual({
      status: 'warning',
      detail: '1 booking not sent for 3 hours. Last error: HubSpot 401',
    });
    expect(
      judgeHubspot({ connected: true, waiting: 4, oldestAt: now - hours(7) }, now).status
    ).toBe('problem');
  });
});

describe('judgeEmail', () => {
  it('is a problem in production without a key, and a warning elsewhere', () => {
    expect(judgeEmail({ hasKey: true, production: true })).toEqual({
      status: 'ok',
      detail: 'Sign-in links and invitations can be sent.',
    });
    expect(judgeEmail({ hasKey: false, production: true })).toEqual({
      status: 'problem',
      detail: 'No email key, so sign-in links and invitations cannot be sent.',
    });
    expect(judgeEmail({ hasKey: false, production: false })).toEqual({
      status: 'warning',
      detail: 'Not sending here: sign-in links are printed in the terminal.',
    });
  });
});

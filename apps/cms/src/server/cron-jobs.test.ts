import { describe, expect, it } from 'vitest';
import { heartbeatFor, jobHeartbeats } from './cron-jobs';

const env = (value?: unknown) =>
  ({
    HEARTBEAT_URLS:
      typeof value === 'string' || value === undefined ? value : JSON.stringify(value),
  }) as unknown as Cloudflare.Env;

describe('heartbeat addresses', () => {
  const all = env({
    'every-5-minutes': 'https://uptime.example.test/five',
    daily: 'https://uptime.example.test/daily',
    'publish-posts': 'https://uptime.example.test/posts',
    'sync-bookings': 'https://uptime.example.test/sync',
  });

  it("reads each schedule's heartbeat from the one secret", () => {
    expect(heartbeatFor('every-5-minutes', all)).toBe('https://uptime.example.test/five');
    expect(heartbeatFor('daily', all)).toBe('https://uptime.example.test/daily');
  });

  it('reads the jobs that have their own heartbeat, and only those', () => {
    expect(jobHeartbeats(all)).toEqual({
      'publish-posts': 'https://uptime.example.test/posts',
      'sync-bookings': 'https://uptime.example.test/sync',
    });
  });

  it('drops unknown keys and anything that is not an https address', () => {
    const odd = env({
      'no-such-job': 'https://uptime.example.test/a',
      'publish-posts': 'http://uptime.example.test/b',
      daily: 42,
    });
    expect(jobHeartbeats(odd)).toEqual({});
    expect(heartbeatFor('daily', odd)).toBeUndefined();
  });

  it('pings nothing when unset or unreadable', () => {
    expect(heartbeatFor('daily', env())).toBeUndefined();
    expect(jobHeartbeats(env('not json'))).toEqual({});
  });
});

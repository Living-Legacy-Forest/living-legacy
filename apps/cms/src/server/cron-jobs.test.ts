import { describe, expect, it } from 'vitest';
import { jobHeartbeats } from './cron-jobs';

const env = (value?: string) => ({ HEARTBEAT_URLS_BY_JOB: value }) as unknown as Cloudflare.Env;

describe('jobHeartbeats', () => {
  it('reads the addresses of known jobs', () => {
    expect(
      jobHeartbeats(
        env(
          JSON.stringify({
            'publish-posts': 'https://uptime.example.test/a',
            'sync-bookings': 'https://uptime.example.test/b',
          })
        )
      )
    ).toEqual({
      'publish-posts': 'https://uptime.example.test/a',
      'sync-bookings': 'https://uptime.example.test/b',
    });
  });

  it('drops unknown jobs and anything that is not an https address', () => {
    expect(
      jobHeartbeats(
        env(
          JSON.stringify({
            'no-such-job': 'https://uptime.example.test/a',
            'publish-posts': 'http://uptime.example.test/b',
            'sync-bookings': 42,
          })
        )
      )
    ).toEqual({});
  });

  it('is empty when unset or unreadable', () => {
    expect(jobHeartbeats(env())).toEqual({});
    expect(jobHeartbeats(env('not json'))).toEqual({});
  });
});

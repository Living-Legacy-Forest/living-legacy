// One colour per status for the System page and the header's status: green
// working, yellow worth an eye, red needs fixing. Plain data, safe in the browser.
import type { JobHealth } from './cron-jobs';

/** A health check's result: green, yellow or red. */
export type HealthStatus = 'ok' | 'warning' | 'problem';
export type StatusTone = 'green' | 'yellow' | 'red';

export const checkTone: Record<HealthStatus, StatusTone> = {
  ok: 'green',
  warning: 'yellow',
  problem: 'red',
};

export const jobTone: Record<JobHealth, StatusTone> = {
  ok: 'green',
  waiting: 'yellow',
  failed: 'red',
  stale: 'red',
};

const RANK: Record<StatusTone, number> = { green: 0, yellow: 1, red: 2 };

/** The worst tone, and how many of each of the bad ones. */
export function summariseTones(tones: StatusTone[]) {
  return {
    overall: tones.reduce<StatusTone>((worst, t) => (RANK[t] > RANK[worst] ? t : worst), 'green'),
    red: tones.filter((t) => t === 'red').length,
    yellow: tones.filter((t) => t === 'yellow').length,
  };
}

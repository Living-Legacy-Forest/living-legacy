# Observability (CMS)

Two free accounts split the work. **Better Stack** answers "is it up, and did it run?".
**Sentry** answers "what broke, and why?". Each check lives in one tool only; a failed job
shows in both because Better Stack says that it failed and Sentry says why. The website (`apps/web`) is not covered here yet; its errors go to PostHog.

| Signal                                        | Where        | Alerts                                                                                  |
| --------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| CMS answering, via `/api/health`              | Better Stack | Email when the check fails                                                              |
| 5-minute jobs ran (publishing, HubSpot sync)  | Better Stack | Email after 15 minutes without a ping                                                   |
| Daily jobs ran                                | Better Stack | Email after 25 hours without a ping                                                     |
| A job failed                                  | Both         | Heartbeat gets `/fail` and raises an incident; the error is a Sentry issue tagged `job` |
| Errors with stack traces (browser and Worker) | Sentry       | Email on new or high-priority issues                                                    |
| Traces, releases, deploy markers              | Sentry       | None                                                                                    |

The System page in the CMS shows each job's last run and links to both tools.

## Better Stack

- **CMS health** monitor: `GET https://cms.livinglegacy.com.au/api/health` every 3 minutes
  (the free plan's fastest) from four regions. It returns `200 ok`, or `503 failing: …` naming
  what failed. The check fails for any of:
  - the CMS Worker not answering;
  - the website home page not loading within 5 seconds (`server/system-health.ts`);
  - no 5-minute job run for 15 minutes.

  So a 503 from this monitor is not always the CMS itself: read the body.

- **CMS jobs, every 5 minutes** and **CMS jobs, daily** heartbeats. After each run the schedule
  POSTs to its heartbeat, or to the heartbeat address plus `/fail` if any job threw
  (`server/cron-monitor.ts`). Period plus grace is 5 + 10 minutes and 24 hours + 1 hour,
  matching `staleAfterMs` in `lib/cron-jobs.ts`; change both together.
- The heartbeat addresses are Worker secrets, `HEARTBEAT_URL_EVERY_5_MINUTES` and
  `HEARTBEAT_URL_DAILY`. Anyone holding one can mark a job as run, so they never go in
  `wrangler.jsonc` or the repo. Unset (local development) means no ping. To replace one, from
  `apps/cms`: `bunx wrangler secret put HEARTBEAT_URL_DAILY`.
- A ping that cannot be sent is reported to Sentry tagged `job: heartbeat` and never fails the run.

## Sentry

- Set up in `lib/sentry.ts` (shared options), `server.ts` (Worker: requests, cron runs, D1) and
  `router.tsx` (browser). Production only.
- Every request is traced except media and `/api/health`. If traffic outgrows the free plan's
  monthly quota, lower `tracesSampleRate` in `lib/sentry.ts` first; errors matter more than
  traces.
- Request bodies and cookies are never sent: editors type names, emails and unpublished content.
- "Server function info not found" is ignored: an old tab after a deploy, which the CMS offers
  to reload.
- Each production deploy creates a release named after the commit and marks it deployed
  (`vite.config.ts`), so an issue shows which deploy introduced it.

## When something breaks

1. **Monitor down.** Open `/api/health` in a browser. `failing: website` is the website, not
   the CMS. `failing: scheduled jobs` means the 5-minute jobs stopped; go to step 2. No answer at
   all: check the Worker in the Cloudflare dashboard (Workers Logs) and recent deploys.
2. **Heartbeat missed.** The cron trigger did not run or the Worker crashed before pinging. Check
   the System page for each job's last run, then Workers Logs for the scheduled event.
3. **Heartbeat failed (`/fail`).** At least one job threw. In Sentry, filter issues by the `job`
   tag; the System page shows the error message too.
4. **Sentry issue.** Check its release to see which deploy introduced it, and the trace for the
   request around it.

## Free-plan limits

- Sentry has one user seat, so its alerts reach one person.
- Better Stack checks every 3 minutes at most, and allows 10 monitors and 10 heartbeats per
  account, shared with other sites on the same account.

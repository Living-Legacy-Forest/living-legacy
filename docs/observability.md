# Observability (CMS)

Two free accounts split the work. **Better Stack** answers "is it up, did it run, and what did it
log?". **Sentry** answers "what broke, and why?". Each check lives in one tool only; a failed job
shows in both because Better Stack says that it failed and Sentry says why. The website
(`apps/web`) is not covered here yet; its errors go to PostHog.

| Signal                                        | Where        | Alerts                                                          |
| --------------------------------------------- | ------------ | --------------------------------------------------------------- |
| CMS answering, via `/api/health`              | Better Stack | Email when the check fails                                      |
| Each schedule ran                             | Better Stack | Email after 15 minutes (5-minute jobs) or 25 hours (daily)      |
| Key jobs ran, each on its own heartbeat       | Better Stack | Same timing; the incident names the job                         |
| A job failed                                  | Both         | Heartbeat `/fail` raises an incident; Sentry issue tagged `job` |
| Worker logs (`console.*`), emails masked      | Better Stack | None; kept 3 days                                               |
| Errors with stack traces (browser and Worker) | Sentry       | Email on new or high-priority issues                            |
| Traces, releases, deploy markers              | Sentry       | None                                                            |
| Report a problem (from editors)               | Sentry       | As a user feedback item                                         |

The System page in the CMS shows each job's last run and links to both tools.

## Better Stack

### Uptime

**CMS health** monitor: `GET https://cms.livinglegacy.com.au/api/health` every 3 minutes (the
free plan's fastest) from four regions. It returns `200 ok`, or `503 failing: …` naming what
failed. The check fails for any of:

- the CMS Worker not answering;
- the website home page not loading within 5 seconds (`server/system-health.ts`);
- no 5-minute job run for 15 minutes.

So a 503 from this monitor is not always the CMS itself: read the body.

### Heartbeats

After each run, a schedule POSTs to its own heartbeat, and each job with a heartbeat POSTs to
that one too (`server/cron-monitor.ts`). A failure pings the address plus `/fail`: any failed
job for the schedule's heartbeat, that job for its own.

| Heartbeat                                       | Key                  | Period + grace |
| ----------------------------------------------- | -------------------- | -------------- |
| CMS jobs, every 5 minutes                       | `every-5-minutes`    | 5 + 10 minutes |
| CMS jobs, daily                                 | `daily`              | 24 hours + 1   |
| CMS job: publish scheduled posts                | `publish-posts`      | 5 + 10 minutes |
| CMS job: publish scheduled events               | `publish-events`     | 5 + 10 minutes |
| CMS job: send bookings to HubSpot               | `sync-bookings`      | 5 + 10 minutes |
| CMS job: delete bookings a year after the event | `purge-old-bookings` | 24 hours + 1   |

The other daily jobs (`lib/cron-jobs.ts`) are covered by the daily heartbeat only. Period plus
grace matches `staleAfterMs` in `lib/cron-jobs.ts`; change both together.

Every address lives in one Worker secret, `HEARTBEAT_URLS`: a JSON object from key to address,
for example `{"every-5-minutes": "https://…", "sync-bookings": "https://…"}`. Unknown keys,
addresses that are not `https://` and unreadable JSON are ignored; unset (local development)
pings nothing. Anyone holding an address can mark a job as run, so the secret never goes in
`wrangler.jsonc` or the repo. To change it, from `apps/cms`:

```sh
bunx wrangler secret put HEARTBEAT_URLS   # paste the whole JSON object
```

Adding a job heartbeat: create it in Better Stack, then add its key to the object and put the
secret again. A ping that cannot be sent is reported to Sentry tagged `job: heartbeat` (or
`heartbeat:<job>`) and never fails the run.

### Logs

Workers Logs go to the OpenTelemetry destination `betterstack-cms-logs` (set in the Cloudflare
dashboard, named in `wrangler.jsonc`), which feeds the Better Stack source "Living Legacy CMS".
They stay in Cloudflare's Workers Logs as well. `lib/redact-console.ts` masks email addresses in
every `console.*` call before it leaves the Worker (`jo@example.com` → `j***@example.com`).

## Sentry

- Set up in `lib/sentry.ts` (shared options), `server.ts` (Worker: requests, cron runs, D1) and
  `router.tsx` (browser). Production only.
- Every request is traced except media and `/api/health`. If traffic outgrows the free plan's
  monthly quota, lower `tracesSampleRate` in `lib/sentry.ts` first; errors matter more than
  traces.
- Request bodies and cookies are never sent. Email addresses in messages, exceptions,
  breadcrumbs, tags and URLs are masked before sending (`scrubEmails`), with the same masking as
  the logs. Events carry the editor's user id and `role` tag, never a name or email.
- "Server function info not found" is ignored: an old tab after a deploy, which the CMS offers
  to reload.
- Each production deploy creates a release named after the commit and marks it deployed
  (`vite.config.ts`), so an issue shows which deploy introduced it.
- **Report a problem** in the account menu sends a description and optional screenshot to Sentry
  as user feedback (Sentry → User Feedback). It is hidden where Sentry is off.

## When something breaks

1. **Monitor down.** Open `/api/health` in a browser. `failing: website` is the website, not the
   CMS. `failing: scheduled jobs` means the 5-minute jobs stopped; go to step 2. No answer at
   all: check the Worker and recent deploys in the Cloudflare dashboard.
2. **Heartbeat missed.** The cron trigger did not run or the Worker crashed before pinging. If
   only one job's heartbeat is missing, that job is hanging or stuck. Check the System page for
   each job's last run, then the logs in Better Stack around the scheduled time.
3. **Heartbeat failed (`/fail`).** A job threw. The job heartbeat names it; in Sentry, filter
   issues by the `job` tag. The System page shows the error message too.
4. **Sentry issue.** Check its release to see which deploy introduced it, its `role` tag, and the
   trace and logs for the request around it.

## Free-plan limits

- Sentry has one user seat, so its alerts and feedback reach one person.
- Better Stack checks every 3 minutes at most and keeps logs for 3 days. Monitors and heartbeats
  are capped per account and shared with other sites on it; check the count before adding more.

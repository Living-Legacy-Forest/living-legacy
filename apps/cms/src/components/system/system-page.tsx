import { Suspense, lazy } from 'react';
import { ExternalLinkIcon } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { buildInfo } from '@/lib/build-info';
import type { JobHealth } from '@/lib/cron-jobs';
import { formatDateTime, formatDuration, formatInteger, formatRelative } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useTimeZone } from '@/lib/use-time-zone';
import type { SystemStatus } from '@/server/system';
import { type HealthStatus, checkTone, jobTone, summariseTones } from '@/lib/system-status';
import { FailuresList } from './failures-list';
import { StatusPulse } from './status-pulse';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

// Uptime, heartbeats and their alerts live in Better Stack; errors in Sentry
// (the org vite.config.ts uploads source maps to).
const LINKS = [
  { label: 'Uptime', href: 'https://uptime.betterstack.com/' },
  { label: 'Errors', href: 'https://living-legacy.sentry.io/issues/' },
];

const JobCharts = lazy(() => import('./system-charts').then((m) => ({ default: m.JobCharts })));
const AssistantCard = lazy(() =>
  import('./assistant-card').then((m) => ({ default: m.AssistantCard }))
);
const UsageCard = lazy(() => import('./system-charts').then((m) => ({ default: m.UsageCard })));

const JOB_LABEL: Record<JobHealth, string> = {
  ok: 'Working',
  waiting: 'Not run yet',
  failed: 'Failed',
  stale: 'Not run lately',
};

const CHECK_LABEL: Record<HealthStatus, string> = {
  ok: 'Working',
  warning: 'Check',
  problem: 'Problem',
};

const rowClass = 'touch:min-h-11 -mx-2 px-2';

function took(ms: number) {
  if (ms < 1000) return 'took under a second';
  const seconds = Math.round(ms / 1000);
  return `took ${formatInteger(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`;
}

type JobStats = SystemStatus['schedules'][number]['jobs'][number]['stats'];

function statsLine(stats: JobStats) {
  if (!stats) return null;
  const failed = stats.failed === 0 ? 'none failed' : `${formatInteger(stats.failed)} failed`;
  const runs = `${formatInteger(stats.runs)} ${stats.runs === 1 ? 'run' : 'runs'} in 14 days, ${failed}.`;
  return `${runs} Usually ${formatDuration(stats.averageMs)}, slowest ${formatDuration(stats.slowestMs)}.`;
}

function versionLine(timeZone: string) {
  if (buildInfo.isDev) return 'Local development.';
  const commit = buildInfo.commit ? `, commit ${buildInfo.commit}` : '';
  return `Version ${buildInfo.version}${commit}, built ${formatDateTime(buildInfo.builtAt, timeZone)}.`;
}

/**
 * Admins' view of the services the CMS depends on and the jobs it runs on a
 * timer. Better Stack and Sentry have the history and send the alerts.
 */
export function SystemPage({
  data,
  canResetAssistant = false,
}: {
  data: SystemStatus;
  /** Only a super admin may reset the writing assistant's usage. */
  canResetAssistant?: boolean;
}) {
  const timeZone = useTimeZone();
  const { schedules, failures, health, history, usage, assistant } = data;
  const { overall, red, yellow } = summariseTones([
    ...health.map((check) => checkTone[check.status]),
    ...schedules.flatMap((s) => s.jobs.map((job) => jobTone[job.health])),
  ]);

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="grid w-full gap-6 lg:grid-cols-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 lg:col-span-2">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            <RevealWords text="System" />
          </h1>
          <StatusPulse
            tone={overall}
            // A sentence, unlike the rows' one-word labels: let it wrap on phones.
            className="text-sm whitespace-normal"
            label={
              red > 0
                ? `${formatInteger(red)} ${red === 1 ? 'thing needs' : 'things need'} a look.`
                : yellow > 0
                  ? `Working, with ${formatInteger(yellow)} ${yellow === 1 ? 'thing' : 'things'} to keep an eye on.`
                  : 'Everything is working.'
            }
          />
        </div>
        <div className="flex gap-2">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {link.label}
              <ExternalLinkIcon aria-hidden />
            </a>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>Checked just now, when this page opened.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-0">
            {health.map((check) => {
              const tone = checkTone[check.status];
              return (
                <Item key={check.key} size="sm" className={rowClass}>
                  <ItemContent className="min-w-0">
                    <ItemTitle>{check.title}</ItemTitle>
                    <ItemDescription className="wrap-break-word">{check.detail}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusPulse tone={tone} label={CHECK_LABEL[check.status]} />
                  </ItemActions>
                </Item>
              );
            })}
            <Item size="sm" className={rowClass}>
              <ItemContent className="min-w-0">
                <ItemTitle>This version</ItemTitle>
                <ItemDescription>{versionLine(timeZone)}</ItemDescription>
              </ItemContent>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>

      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <UsageCard usage={usage} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl lg:col-span-2" />}>
        <JobCharts history={history} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />}>
        <AssistantCard assistant={assistant} canReset={canResetAssistant} />
      </Suspense>

      {schedules.map((schedule) => (
        <Card key={schedule.key}>
          <CardHeader>
            <CardTitle>{schedule.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-0">
              {schedule.jobs.map((job) => {
                const tone = jobTone[job.health];
                return (
                  <Item key={job.key} size="sm" className={rowClass}>
                    <ItemContent className="min-w-0">
                      <ItemTitle>{job.title}</ItemTitle>
                      <ItemDescription>
                        {job.lastRun
                          ? `Last ran ${formatRelative(job.lastRun.startedAt)}, ${took(job.lastRun.durationMs)}`
                          : 'Has not run since this page was added.'}
                      </ItemDescription>
                      {job.stats && (
                        <ItemDescription className="tabular-nums">
                          {statsLine(job.stats)}
                        </ItemDescription>
                      )}
                      {job.lastRun?.error && (
                        <p className="text-destructive text-sm wrap-break-word">
                          {job.lastRun.error}
                        </p>
                      )}
                    </ItemContent>
                    <ItemActions>
                      <StatusPulse tone={tone} label={JOB_LABEL[job.health]} />
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </CardContent>
        </Card>
      ))}

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent failures</CardTitle>
          <CardDescription>The last 14 days, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <FailuresList failures={failures} timeZone={timeZone} />
        </CardContent>
      </Card>
    </div>
  );
}

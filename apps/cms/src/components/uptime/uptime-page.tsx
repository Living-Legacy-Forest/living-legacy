import { MetricCard } from '@/components/arc/metric-card/metric-card';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { ExternalLinkIcon } from '@/components/icons';
import { Pager } from '@/components/pager';
import { StatusPulse } from '@/components/system/status-pulse';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { formatDateTime, formatInteger, formatRelative } from '@/lib/format';
import { summariseTones, type StatusTone } from '@/lib/system-status';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import type { MonitorState, UptimeData, UptimeIncident, UptimeMonitor } from '@/server/uptime';

const TONE: Record<MonitorState, StatusTone> = {
  up: 'green',
  down: 'red',
  checking: 'yellow',
  paused: 'yellow',
};
const LABEL: Record<MonitorState, string> = {
  up: 'Up',
  down: 'Down',
  checking: 'Checking',
  paused: 'Paused',
};

const percent = (value: number | null) =>
  value === null ? '–' : `${value >= 99.995 ? '100' : value.toFixed(2)}%`;

function downtime(seconds: number) {
  if (seconds < 60) return seconds === 0 ? 'No downtime' : `${seconds}s down`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m down`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m down`;
}

function span(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
    : `${Math.floor(hours / 24)} days`;
}

const dayFormat = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** One cell per day, as a status page draws it: green up, amber a short outage, red a long one. */
function DailyBar({
  daily,
  uptime,
  anchor,
}: {
  daily: number[];
  uptime: number;
  /** When the figures were read; the last cell is that day. */
  anchor: number;
}) {
  const last = anchor;
  return (
    <div className="w-full">
      <div
        role="img"
        aria-label={`Uptime over the last ${daily.length} days: ${uptime.toFixed(2)}%`}
        className="flex h-7 gap-px max-sm:h-6"
      >
        {daily.map((seconds, i) => {
          const date = new Date(last - (daily.length - 1 - i) * 86_400_000);
          return (
            <span
              key={i}
              title={`${dayFormat.format(date)}: ${seconds === 0 ? 'no downtime' : downtime(seconds)}`}
              className={cn(
                'min-w-0 flex-1 rounded-[2px]',
                seconds === 0 ? 'bg-emerald-500' : seconds < 1800 ? 'bg-amber-500' : 'bg-red-500'
              )}
            />
          );
        })}
      </div>
      <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-xs">
        <span>{daily.length} days ago</span>
        <span aria-hidden className="bg-border h-px flex-1" />
        <span className="tabular-nums">{percent(uptime)} uptime</span>
        <span aria-hidden className="bg-border h-px flex-1" />
        <span>Today</span>
      </div>
    </div>
  );
}

const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

function MonitorRow({ monitor, anchor }: { monitor: UptimeMonitor; anchor: number }) {
  return (
    <li className="touch:min-h-11 flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-ui truncate font-medium">{monitor.name}</p>
        <p className="text-muted-foreground truncate font-mono text-xs">{host(monitor.url)}</p>
      </div>
      <StatusPulse tone={TONE[monitor.state]} label={LABEL[monitor.state]} className="w-20" />
      <div className="text-right tabular-nums max-sm:text-left">
        <p className="text-ui font-medium">{percent(monitor.availability)}</p>
        <p className="text-muted-foreground text-xs">{downtime(monitor.downtimeSeconds)}</p>
      </div>
      <p className="text-muted-foreground w-24 text-right text-xs tabular-nums max-sm:text-left">
        {monitor.responseMs === null ? '–' : `${formatInteger(monitor.responseMs)} ms avg`}
      </p>
      <div className="basis-full pt-1.5">
        <DailyBar daily={monitor.daily} uptime={monitor.uptime90} anchor={anchor} />
      </div>
    </li>
  );
}

const INCIDENTS_PER_PAGE = 10;
const INCIDENT_PAGE_SIZES = [10, 25, 50, 100] as const;

function IncidentList({ incidents, timeZone }: { incidents: UptimeIncident[]; timeZone: string }) {
  const [wanted, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(INCIDENTS_PER_PAGE);
  const pageCount = Math.max(1, Math.ceil(incidents.length / pageSize));
  // Fresh data can hold fewer incidents than the page asked for.
  const page = Math.min(wanted, pageCount);
  const from = (page - 1) * pageSize;
  const shown = incidents.slice(from, from + pageSize);
  return (
    <>
      <ul className="divide-y">
        {shown.map((i) => (
          <li key={i.id} className="space-y-0.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-ui min-w-0 truncate font-medium">{i.name}</p>
              <StatusPulse
                tone={i.resolvedAt ? 'green' : 'red'}
                label={i.resolvedAt ? 'Resolved' : 'Ongoing'}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(i.startedAt, timeZone)}
              {i.resolvedAt && ` · lasted ${span(Math.round((i.resolvedAt - i.startedAt) / 1000))}`}
              {i.cause && ` · ${i.cause}`}
            </p>
          </li>
        ))}
      </ul>
      {/* With no more incidents than the smallest page, there is nothing to page or to choose. */}
      {incidents.length > INCIDENT_PAGE_SIZES[0] && (
        <Pager
          page={page}
          pageCount={pageCount}
          total={incidents.length}
          pageSize={pageSize}
          noun="incidents"
          label="Incident pages"
          onPageChange={setPage}
          rows={{
            options: INCIDENT_PAGE_SIZES,
            // A new page size starts again from the first page.
            onChange: (rows) => {
              setPageSize(rows);
              setPage(1);
            },
          }}
        />
      )}
    </>
  );
}

/** Admins' view of Better Stack's monitors: state, 30-day availability and recent incidents. */
export function UptimePage({ data }: { data: UptimeData }) {
  const timeZone = useTimeZone();
  const revealing = useRevealOnce();
  const monitors = data.connected ? data.monitors : [];
  const fetchedAt = data.connected ? data.fetchedAt : 0;
  const measured = monitors.filter((m) => m.availability !== null);
  const avgAvailability = measured.length
    ? measured.reduce((sum, m) => sum + (m.availability ?? 0), 0) / measured.length
    : null;
  const timed = monitors.filter((m) => m.responseMs !== null);
  const avgResponse = timed.length
    ? Math.round(timed.reduce((sum, m) => sum + (m.responseMs ?? 0), 0) / timed.length)
    : null;
  const earlier = monitors.filter((m) => m.previousAvailability !== null);
  const previousAvailability = earlier.length
    ? earlier.reduce((sum, m) => sum + (m.previousAvailability ?? 0), 0) / earlier.length
    : null;
  const availabilityShift =
    avgAvailability !== null && previousAvailability !== null
      ? avgAvailability - previousAvailability
      : null;
  const incidentShift = data.connected ? data.incidentCount - data.previousIncidents : null;
  const { overall, red, yellow } = summariseTones(monitors.map((m) => TONE[m.state]));

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="grid w-full gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            <RevealWords text="Uptime" />
          </h1>
          {data.connected ? (
            <StatusPulse
              tone={overall}
              className="text-sm whitespace-normal"
              label={
                red > 0
                  ? `${formatInteger(red)} ${red === 1 ? 'monitor is' : 'monitors are'} down.`
                  : yellow > 0
                    ? `Up, with ${formatInteger(yellow)} ${yellow === 1 ? 'monitor' : 'monitors'} to look at.`
                    : 'Everything is up.'
              }
            />
          ) : (
            <p role="status" className="text-muted-foreground text-sm">
              Uptime isn&apos;t connected to the CMS yet, so there is nothing to show.
            </p>
          )}
        </div>
        <a
          href="https://uptime.betterstack.com/"
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'touch:min-h-11')}
        >
          Open monitoring
          <ExternalLinkIcon aria-hidden />
        </a>
      </div>

      <div className="grid gap-4 max-md:gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Uptime"
          value={avgAvailability ?? 0}
          empty={avgAvailability === null}
          decimals={2}
          suffix="%"
          context={
            availabilityShift === null
              ? 'Average, last 30 days'
              : 'Compared with the previous 30 days'
          }
          change={
            availabilityShift === null
              ? undefined
              : Math.abs(availabilityShift) < 0.005
                ? 'No change'
                : `${availabilityShift > 0 ? '+' : '−'}${Math.abs(availabilityShift).toFixed(2)}%`
          }
        />
        <MetricCard
          label="Monitors up"
          value={monitors.filter((m) => m.state === 'up').length}
          empty={!data.connected}
          suffix={` of ${monitors.length}`}
          context="Right now"
        />
        <MetricCard
          label="Incidents"
          value={data.connected ? data.incidentCount : 0}
          empty={!data.connected}
          context={incidentShift === null ? 'Last 30 days' : 'Compared with the previous 30 days'}
          lowerIsBetter
          change={
            incidentShift === null
              ? undefined
              : incidentShift === 0
                ? 'No change'
                : `${incidentShift > 0 ? '+' : '−'}${Math.abs(incidentShift)}`
          }
        />
        <MetricCard
          label="Response time"
          value={avgResponse ?? 0}
          empty={avgResponse === null}
          suffix=" ms"
          context="Average, last 24 hours"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monitors</CardTitle>
          <CardDescription>
            Availability over the last 30 days.
            {data.connected && ` Updated ${formatRelative(data.fetchedAt)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No monitors to show.</p>
          ) : (
            <ul className="divide-y">
              {monitors.map((m) => (
                <MonitorRow key={m.id} monitor={m} anchor={fetchedAt} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent incidents</CardTitle>
          <CardDescription>The last 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data.connected || data.incidents.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {data.connected ? 'No incidents in the last 30 days.' : 'No incidents to show.'}
            </p>
          ) : (
            <IncidentList incidents={data.incidents} timeZone={timeZone} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Link } from '@tanstack/react-router';
import { BarChart } from '@/components/arc/bar-chart/bar-chart';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SuperAdminAction } from '@/components/super-admin-action';
import { formatCompact, formatInteger } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { resetAssistantUsage } from '@/server/super-admin';
import { cn } from '@/lib/utils';
import type { SystemStatus } from '@/server/system';
import { StatusPulse } from './status-pulse';

// Loaded on its own with the other charts, so the chart library doesn't hold up the checks above.

type Assistant = SystemStatus['assistant'];
type Totals = Assistant['today'];

/** "$0.0004" for tiny sums, "$1.20" once it is worth reading as money. US dollars, an estimate. */
function dollars(amount: number) {
  if (amount === 0) return '$0';
  const places = amount < 0.01 ? 4 : amount < 1 ? 3 : 2;
  return '$' + amount.toFixed(places);
}

function dayLabel(day: string, style: 'short' | 'long') {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-AU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(style === 'long' && { weekday: 'short' as const }),
  });
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function tokens(totals: Totals) {
  const sent = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
  return formatCompact(sent) + ' in, ' + formatCompact(totals.outputTokens) + ' out';
}

function trouble(totals: Totals) {
  const parts = [
    totals.failed > 0 && formatInteger(totals.failed) + ' failed',
    totals.refused > 0 && formatInteger(totals.refused) + ' refused',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'none failed';
}

/** The writing assistant: whether it is on, what it has done today and this week, and who used it. */
export function AssistantCard({
  assistant,
  canReset = false,
}: {
  assistant: Assistant;
  canReset?: boolean;
}) {
  const { run, pending } = useAction();
  const { keySet, switchedOn, dailyLimit, today, week, days, top } = assistant;
  const tone = !keySet || !switchedOn ? 'yellow' : 'green';
  const state = !keySet ? 'Not set up' : !switchedOn ? 'Switched off' : 'Working';
  const noun = today.suggestions === 1 ? 'suggestion' : 'suggestions';
  const people = today.people === 1 ? 'person' : 'people';
  const description = !keySet
    ? 'No key is set on the server, so the Suggest buttons are hidden.'
    : !switchedOn
      ? 'Switched off in Settings. The Suggest buttons are hidden.'
      : formatInteger(today.suggestions) +
        ' ' +
        noun +
        ' today from ' +
        formatInteger(today.people) +
        ' ' +
        people +
        '. Up to ' +
        formatInteger(dailyLimit) +
        ' each.';

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Writing assistant</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="flex items-center gap-3">
          <StatusPulse tone={tone} label={state} />
          {canReset && (
            <SuperAdminAction
              label="Reset usage"
              title="Reset the writing assistant's usage?"
              description="Everyone's counts and the usage history on this page are erased, and today's daily limit starts again for everyone. This cannot be undone."
              confirmLabel="Reset usage"
              pending={pending}
              onConfirm={() =>
                run(() => resetAssistantUsage(), {
                  success: {
                    title: 'Usage reset',
                    description: "The writing assistant's counts and history were cleared.",
                  },
                  error: 'Could not reset the usage',
                })
              }
            />
          )}
          <Link
            to="/settings"
            hash="writing-assistant"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'touch:min-h-11')}
          >
            Settings
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Figure
              label="Today"
              value={formatInteger(today.suggestions)}
              hint={tokens(today) + ' tokens'}
            />
            <Figure
              label="Estimated cost today"
              value={dollars(today.costUsd)}
              hint={trouble(today)}
            />
            <Figure
              label="Last 7 days"
              value={formatInteger(week.suggestions)}
              hint={tokens(week) + ' tokens'}
            />
            <Figure
              label="Estimated cost, 7 days"
              value={dollars(week.costUsd)}
              hint={trouble(week)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Most used today</p>
            {top.length === 0 ? (
              <p className="text-muted-foreground text-sm">No one has used it today.</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {top.map((person) => (
                  <li key={person.name} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{person.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatInteger(person.count)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Costs are estimates at list prices in US dollars. The Anthropic Console has the real
            bill and the monthly spend limit.
          </p>
        </div>
        <BarChart
          label="Suggestions"
          period={dayLabel(days[0]!.day, 'short') + ' to ' + dayLabel(days.at(-1)!.day, 'short')}
          height={190}
          averageLabel="Daily average"
          valueLabel="Suggestions"
          categoryLabel="Day"
          data={days.map((d) => ({
            key: d.day,
            label: dayLabel(d.day, 'long'),
            axisLabel: dayLabel(d.day, 'short'),
            value: d.suggestions,
          }))}
          formatValue={formatInteger}
        />
      </CardContent>
    </Card>
  );
}

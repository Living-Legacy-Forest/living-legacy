import { ChartAreaIcon } from '@/components/icons';
import { useId, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatChartAxisTick, formatChartRange, formatInteger } from '@/lib/format';
import type { DashboardData } from '@/server/dashboard';

type PeriodDays = 30 | 60 | 90;
type Week = { date: string; end: string; published: number };

// Base UI's Select shows the raw value unless it is given the item labels.
const periodItems = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const chartConfig = {
  published: { label: 'Posts published', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/**
 * Days grouped into weeks ending today. Posts go out a few times a month, so
 * per day the chart is mostly zero with a spike for each post; per week it
 * reads as a rhythm.
 */
function byWeek(days: DashboardData['activity']): Week[] {
  const weeks: Week[] = [];
  for (let end = days.length; end > 0; end -= 7) {
    const chunk = days.slice(Math.max(0, end - 7), end);
    weeks.unshift({
      date: chunk[0]?.date ?? '',
      end: chunk[chunk.length - 1]?.date ?? '',
      published: chunk.reduce((sum, day) => sum + day.published, 0),
    });
  }
  return weeks;
}

// Follows shadcn's interactive area chart: a range picker in the header,
// horizontal grid lines, a smooth curve over a gradient and a dot tooltip.
export function PublishingChart({ activity }: { activity: DashboardData['activity'] }) {
  const gradientId = `publishing-grad-${useId().replace(/:/g, '')}`;
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);

  const weeks = useMemo(() => byWeek(activity.slice(-periodDays)), [activity, periodDays]);
  const total = weeks.reduce((sum, week) => sum + week.published, 0);

  return (
    <Card className="col-span-2 lg:col-span-4">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <CardTitle className="text-balance">Publishing activity</CardTitle>
          <CardDescription>Posts published each week</CardDescription>
        </div>
        <Select
          items={periodItems}
          onValueChange={(v) => setPeriodDays(Number(v) as PeriodDays)}
          value={String(periodDays)}
        >
          <SelectTrigger
            aria-label="Publishing activity time range"
            className="w-full min-w-36 sm:w-fit"
            size="sm"
          >
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent align="end">
            {periodItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <Empty className="h-60">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartAreaIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Nothing published</EmptyTitle>
              <EmptyDescription>
                No posts were published in the last {periodDays} days.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer className="aspect-auto h-60 w-full" config={chartConfig}>
            <AreaChart accessibilityLayer data={weeks} margin={{ left: 12, right: 12, top: 8 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-published)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-published)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => formatChartAxisTick(String(value))}
              />
              <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 2)]} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="min-w-44"
                    indicator="dot"
                    labelFormatter={(_, payload) => {
                      const week = payload?.[0]?.payload as Week | undefined;
                      return week ? formatChartRange(week.date, week.end) : '';
                    }}
                  />
                }
              />
              <Area
                dataKey="published"
                // Monotone rather than shadcn's natural: natural swings below
                // zero beside empty weeks, which would read as negative posts.
                type="monotone"
                fill={`url(#${gradientId})`}
                stroke="var(--color-published)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground text-xs">
        {total === 0
          ? `Nothing published in the last ${periodDays} days.`
          : `${formatInteger(total)} ${total === 1 ? 'post' : 'posts'} published in the last ${periodDays} days.`}
      </CardFooter>
    </Card>
  );
}

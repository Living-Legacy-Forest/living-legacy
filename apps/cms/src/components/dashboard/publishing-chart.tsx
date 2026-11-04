import { ChartAreaIcon } from '@/components/icons';
import { useId, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { formatChartAxisTick, formatChartTooltipDate, formatInteger } from '@/lib/format';
import type { DashboardData } from '@/server/dashboard';

type PeriodDays = 30 | 60 | 90;

// Recharts XAxis `interval`: tick skip index (0 = all, 1 = every other, ...).
const xAxisIntervalByPeriod: Record<PeriodDays, number> = { 30: 3, 60: 6, 90: 13 };

// Base UI's Select shows the raw value unless it is given the item labels.
const periodItems = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const chartConfig = {
  published: { label: 'Posts published', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function PublishingChart({ activity }: { activity: DashboardData['activity'] }) {
  const gradientId = `publishing-grad-${useId().replace(/:/g, '')}`;
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const isMobile = useIsMobile();

  const rows = useMemo(() => activity.slice(-periodDays), [activity, periodDays]);
  const total = rows.reduce((sum, row) => sum + row.published, 0);

  return (
    <Card className="col-span-2 lg:col-span-4">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-balance">Publishing activity</CardTitle>
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
          <ChartContainer className="aspect-auto h-60 w-full p-0" config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={[...rows]}
              margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-published)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-published)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} strokeDasharray="2 2" />
              <XAxis
                axisLine={false}
                dataKey="date"
                // A phone has too little width for a fixed spacing; let the
                // chart drop labels that would collide, keeping first and last.
                interval={isMobile ? 'preserveStartEnd' : xAxisIntervalByPeriod[periodDays]}
                minTickGap={isMobile ? 28 : 16}
                tickFormatter={(value) => formatChartAxisTick(String(value), periodDays)}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 2)]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="min-w-40"
                    indicator="line"
                    labelFormatter={(_, payload) => {
                      const date = (payload?.[0]?.payload as { date?: string } | undefined)?.date;
                      return date ? formatChartTooltipDate(date) : '';
                    }}
                  />
                }
              />
              <Area
                dataKey="published"
                dot={false}
                fill={`url(#${gradientId})`}
                stroke="var(--color-published)"
                strokeWidth={2}
                type="monotone"
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

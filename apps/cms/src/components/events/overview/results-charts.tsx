import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { MUTED } from '@/components/stat-card/stat-card';
import { formatInteger } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import type { EventsOverview } from '@/server/event-stats';

// Loaded on its own, so the chart library doesn't hold up the rest of the page.

const bookingsConfig = {
  website: { label: 'Website', color: 'var(--primary)' },
  staff: { label: 'Staff', color: MUTED },
} satisfies ChartConfig;

const turnUpConfig = {
  checkedIn: { label: 'Checked in', color: 'var(--primary)' },
  noShow: { label: 'Did not come', color: MUTED },
} satisfies ChartConfig;

const locationConfig = {
  people: { label: 'People', color: 'var(--primary)' },
} satisfies ChartConfig;

/** Labels for each bucket: "12 Nov", or "Week of 12 Nov" in the tooltip. */
function useBucketLabels(bucket: EventsOverview['bucket']) {
  const timeZone = useTimeZone();
  const short = (start: number) =>
    new Date(start + 1).toLocaleDateString('en-AU', { timeZone, day: 'numeric', month: 'short' });
  return {
    tick: short,
    full: (start: number) => (bucket === 'week' ? `Week of ${short(start)}` : short(start)),
  };
}

const xAxis = (tick: (start: number) => string) => (
  <XAxis
    dataKey="start"
    tickLine={false}
    axisLine={false}
    tickMargin={8}
    minTickGap={24}
    tickFormatter={tick}
  />
);

export function ResultsCharts({ data }: { data: EventsOverview }) {
  return (
    <>
      <BookingsChart data={data} />
      <TurnUpChart data={data} />
      {!data.location && <LocationsChart data={data} />}
    </>
  );
}

function BookingsChart({ data }: { data: EventsOverview }) {
  const labels = useBucketLabels(data.bucket);
  const website = data.bookings.reduce((n, b) => n + b.website, 0);
  const staff = data.bookings.reduce((n, b) => n + b.staff, 0);
  return (
    <Card className="md:col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle>Bookings</CardTitle>
        <CardDescription>People booked, by when they booked.</CardDescription>
        <CardAction className="text-2xl font-semibold tabular-nums">
          {formatInteger(website + staff)}
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={bookingsConfig} className="aspect-auto h-56 w-full">
          <AreaChart data={data.bookings} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} />
            {xAxis(labels.tick)}
            <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) => labels.full(Number(payload[0]?.payload.start))}
                />
              }
            />
            {(['staff', 'website'] as const).map((key) => (
              <Area
                key={key}
                dataKey={key}
                stackId="source"
                type="monotone"
                stroke={`var(--color-${key})`}
                fill={`var(--color-${key})`}
                fillOpacity={0.2}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
        <p className="sr-only">
          {formatInteger(website)} people booked on the website and {formatInteger(staff)} by staff.
        </p>
      </CardContent>
    </Card>
  );
}

function TurnUpChart({ data }: { data: EventsOverview }) {
  const labels = useBucketLabels(data.bucket);
  const { booked, checkedIn, events } = data.turnUpTotals;
  const rate = booked > 0 ? Math.round((checkedIn / booked) * 100) : null;
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Turn-up</CardTitle>
        <CardDescription>Who came, at events where guests were checked in.</CardDescription>
        {rate !== null && (
          <CardAction className="text-2xl font-semibold tabular-nums">{rate}%</CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {events === 0 ? (
          <p className="text-muted-foreground grid h-48 place-items-center text-center text-sm">
            No guests have been checked in at an event in this period.
          </p>
        ) : (
          <ChartContainer config={turnUpConfig} className="aspect-auto h-48 w-full">
            <BarChart data={data.turnUp} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              {xAxis(labels.tick)}
              <YAxis hide allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => labels.full(Number(payload[0]?.payload.start))}
                  />
                }
              />
              <Bar
                dataKey="checkedIn"
                stackId="turnUp"
                fill="var(--color-checkedIn)"
                isAnimationActive={false}
              />
              <Bar
                dataKey="noShow"
                stackId="turnUp"
                fill="var(--color-noShow)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      {events > 0 && (
        <CardFooter className="text-muted-foreground text-xs">
          {formatInteger(checkedIn)} of {formatInteger(booked)} people, over {formatInteger(events)}{' '}
          {events === 1 ? 'event' : 'events'}
        </CardFooter>
      )}
    </Card>
  );
}

function LocationsChart({ data }: { data: EventsOverview }) {
  const rows = data.byLocation;
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>By location</CardTitle>
        <CardDescription>People booked at each forest.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground grid h-48 place-items-center text-center text-sm">
            No bookings in this period.
          </p>
        ) : (
          <ChartContainer
            config={locationConfig}
            className="aspect-auto w-full"
            style={{ height: Math.max(96, rows.length * 36) }}
          >
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 40 }}>
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
              <XAxis type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar
                dataKey="people"
                fill="var(--color-people)"
                radius={4}
                barSize={20}
                isAnimationActive={false}
                label={{
                  position: 'right',
                  className: 'fill-foreground tabular-nums',
                  fontSize: 12,
                }}
              />
            </BarChart>
          </ChartContainer>
        )}
        <p className="sr-only">
          {rows.map((r) => `${r.name}: ${formatInteger(r.people)} people`).join('. ')}
        </p>
      </CardContent>
    </Card>
  );
}

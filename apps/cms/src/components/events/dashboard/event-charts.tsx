import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { MUTED } from '@/components/stat-card/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatInteger } from '@/lib/format';
import type { EventDashboard } from '@/server/event-stats';

// Loaded on its own, so the chart library doesn't hold up the figures above.

const DAY_MS = 86_400_000;

const daysLabel = (days: number) =>
  days === 0 ? 'On the day' : days === 1 ? '1 day before' : `${days} days before`;

const peopleConfig = { people: { label: 'People', color: 'var(--primary)' } } satisfies ChartConfig;
const bookingsConfig = {
  bookings: { label: 'Bookings', color: 'var(--primary)' },
} satisfies ChartConfig;
const datesConfig = {
  checkedIn: { label: 'Checked in', color: 'var(--primary)' },
  notIn: { label: 'Not checked in', color: MUTED },
} satisfies ChartConfig;

type Props = { data: EventDashboard; onDateChange: (date: string | undefined) => void };

export function EventCharts({ data, onDateChange }: Props) {
  return (
    <>
      {data.dates.length > 1 && <DatesChart data={data} onDateChange={onDateChange} />}
      <FillChart data={data} />
      <LeadTimeChart data={data} />
      <PartySizeChart data={data} />
      {data.arrivals.length > 0 && <ArrivalsChart data={data} />}
    </>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground grid h-48 place-items-center text-center text-sm">
      {children}
    </p>
  );
}

/** Every date side by side; the picked one stands out. Click a date to show just it. */
function DatesChart({ data, onDateChange }: Props) {
  const { dates, date } = data;
  const rows = dates.map((d) => ({
    ...d,
    label: new Date(d.startsAt).toLocaleDateString('en-AU', {
      timeZone: d.timeZone,
      day: 'numeric',
      month: 'short',
    }),
    notIn: Math.max(0, d.booked - d.checkedIn),
  }));
  const faded = (id: string) => date !== null && date.id !== id;
  return (
    <Card className="@lg:col-span-2 @4xl:col-span-4">
      <CardHeader>
        <CardTitle>Dates</CardTitle>
        <CardDescription>
          People booked at each date. Click one to see just that date
          {date ? ', or the same one again for all.' : '.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={datesConfig} className="aspect-auto h-48 w-full">
          <BarChart
            data={rows}
            margin={{ left: 0, right: 0 }}
            className="cursor-pointer"
            onClick={(state) => {
              const id = rows[Number(state?.activeTooltipIndex)]?.id;
              if (id) onDateChange(id === date?.id ? undefined : id);
            }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={8}
            />
            <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="checkedIn" stackId="date" isAnimationActive={false}>
              {rows.map((d) => (
                <Cell
                  key={d.id}
                  fill="var(--color-checkedIn)"
                  fillOpacity={faded(d.id) ? 0.35 : 1}
                />
              ))}
            </Bar>
            <Bar
              dataKey="notIn"
              stackId="date"
              radius={[4, 4, 0, 0]}
              minPointSize={2}
              isAnimationActive={false}
            >
              {rows.map((d) => (
                <Cell key={d.id} fill="var(--color-notIn)" fillOpacity={faded(d.id) ? 0.4 : 1} />
              ))}
            </Bar>
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
        <p className="sr-only">
          {rows
            .map(
              (d) =>
                `${d.label}: ${formatInteger(d.booked)} booked, ${formatInteger(d.checkedIn)} checked in`
            )
            .join('. ')}
        </p>
      </CardContent>
    </Card>
  );
}

/** People booked so far, day by day, against the limit and when bookings close. */
function FillChart({ data }: { data: EventDashboard }) {
  const gradient = useId();
  const { date, capacity, timeline, totals } = data;
  const closesDay =
    date && date.bookingsCloseAt !== null
      ? Math.max(0, Math.floor((date.startsAt - date.bookingsCloseAt) / DAY_MS))
      : null;
  const showClose = closesDay !== null && timeline.some((t) => t.daysBefore === closesDay);
  return (
    <Card className="@lg:col-span-2 @4xl:col-span-4">
      <CardHeader>
        <CardTitle>How it filled</CardTitle>
        <CardDescription>
          {date
            ? 'People booked so far, by days before the date.'
            : 'People booked so far, by days before the date they booked for.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totals.bookings === 0 ? (
          <Empty>No bookings yet.</Empty>
        ) : (
          <ChartContainer config={peopleConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={timeline} margin={{ left: 0, right: 12, top: 16 }}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-people)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-people)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="daysBefore"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(d: number) => (d === 0 ? 'Day' : `${d}d`)}
              />
              <YAxis
                hide
                allowDecimals={false}
                domain={[0, (max: number) => Math.max(max, capacity ?? 0, 1)]}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, p) => daysLabel(Number(p[0]?.payload.daysBefore))}
                  />
                }
              />
              {capacity !== null && (
                <ReferenceLine
                  y={capacity}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Limit ${formatInteger(capacity)}`,
                    position: 'insideTopLeft',
                    className: 'fill-muted-foreground text-xs',
                  }}
                />
              )}
              {showClose && (
                <ReferenceLine
                  x={closesDay}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Bookings close',
                    position: 'insideTopRight',
                    className: 'fill-muted-foreground text-xs',
                  }}
                />
              )}
              <Area
                dataKey="people"
                type="stepAfter"
                stroke="var(--color-people)"
                strokeWidth={1.5}
                fill={`url(#${gradient})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
        <p className="sr-only">
          {formatInteger(totals.people)} people booked
          {capacity !== null && ` of ${formatInteger(capacity)} places`}.
        </p>
      </CardContent>
    </Card>
  );
}

function LeadTimeChart({ data }: { data: EventDashboard }) {
  const { leadTime, totals } = data;
  return (
    <Card className="@lg:col-span-2">
      <CardHeader>
        <CardTitle>How far ahead</CardTitle>
        <CardDescription>When people booked, before their date.</CardDescription>
      </CardHeader>
      <CardContent>
        {totals.bookings === 0 ? (
          <Empty>No bookings yet.</Empty>
        ) : (
          <ChartContainer config={bookingsConfig} className="aspect-auto h-48 w-full">
            <BarChart data={leadTime} layout="vertical" margin={{ left: 0, right: 32 }}>
              <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={96} />
              <XAxis type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar
                dataKey="bookings"
                fill="var(--color-bookings)"
                radius={4}
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
          {leadTime.map((b) => `${b.label}: ${formatInteger(b.bookings)}`).join('. ')}
        </p>
      </CardContent>
    </Card>
  );
}

function PartySizeChart({ data }: { data: EventDashboard }) {
  const { partySizes, totals } = data;
  const rows = partySizes.map((p) => ({ ...p, label: `${p.size}` }));
  return (
    <Card className="@lg:col-span-2">
      <CardHeader>
        <CardTitle>Party sizes</CardTitle>
        <CardDescription>Bookings by how many people came together.</CardDescription>
      </CardHeader>
      <CardContent>
        {totals.bookings === 0 ? (
          <Empty>No bookings yet.</Empty>
        ) : (
          <ChartContainer config={bookingsConfig} className="aspect-auto h-48 w-full">
            <BarChart data={rows} margin={{ left: 0, right: 0, top: 16 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis hide allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, p) => `Party of ${Number(p[0]?.payload.size)}`}
                  />
                }
              />
              <Bar
                dataKey="bookings"
                fill="var(--color-bookings)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                label={{ position: 'top', className: 'fill-foreground tabular-nums', fontSize: 12 }}
              />
            </BarChart>
          </ChartContainer>
        )}
        <p className="sr-only">
          {partySizes
            .filter((p) => p.bookings > 0)
            .map((p) => `Parties of ${p.size}: ${formatInteger(p.bookings)}`)
            .join('. ')}
        </p>
      </CardContent>
    </Card>
  );
}

/** When people checked in, in quarter hours: clock times for one date, offsets for all. */
function ArrivalsChart({ data }: { data: EventDashboard }) {
  const { arrivals, date } = data;
  const label = (minutes: number) =>
    date
      ? new Date(date.startsAt + minutes * 60_000).toLocaleTimeString('en-AU', {
          timeZone: date.timeZone,
          hour: 'numeric',
          minute: '2-digit',
        })
      : minutes === 0
        ? 'Start'
        : `${minutes > 0 ? '+' : '−'}${Math.abs(minutes)} min`;
  return (
    <Card className="@lg:col-span-2">
      <CardHeader>
        <CardTitle>Arrivals</CardTitle>
        <CardDescription>
          {date
            ? 'People checked in, every 15 minutes.'
            : 'People checked in, every 15 minutes from the start.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={peopleConfig} className="aspect-auto h-48 w-full">
          <BarChart data={arrivals} margin={{ left: 0, right: 0, top: 16 }}>
            <XAxis
              dataKey="minutes"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={label}
            />
            <YAxis hide allowDecimals={false} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => label(Number(p[0]?.payload.minutes))}
                />
              }
            />
            <Bar
              dataKey="people"
              fill="var(--color-people)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
        <p className="sr-only">
          {arrivals.map((a) => `${label(a.minutes)}: ${formatInteger(a.people)}`).join('. ')}
        </p>
      </CardContent>
    </Card>
  );
}

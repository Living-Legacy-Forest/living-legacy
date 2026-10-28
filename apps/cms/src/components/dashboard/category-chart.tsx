import { useMemo } from 'react';
import { LabelList, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { DashboardData } from '@/server/dashboard';

type CategoryRow = DashboardData['categories'][number];

const SLICE_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** At most four named slices; the rest roll into a fifth, "Others". */
const MAX_NAMED_SLICES = 4;

function consolidate(rows: readonly CategoryRow[]): CategoryRow[] {
  if (rows.length <= MAX_NAMED_SLICES + 1) return [...rows];
  const head = rows.slice(0, MAX_NAMED_SLICES);
  const others = rows.slice(MAX_NAMED_SLICES).reduce((sum, row) => sum + row.posts, 0);
  return [...head, { category: 'Others', posts: others }];
}

function buildSlices(rows: readonly CategoryRow[]) {
  const chartConfig: ChartConfig = { posts: { label: 'Posts' } };
  const pieData = rows.map((row, i) => {
    const key = `s${i}`;
    chartConfig[key] = { label: row.category, color: SLICE_PALETTE[i % SLICE_PALETTE.length] };
    return { key, category: row.category, posts: row.posts, fill: `var(--color-${key})` };
  });
  return { chartConfig, pieData };
}

export function CategoryChart({ categories }: { categories: DashboardData['categories'] }) {
  const { chartConfig, pieData } = useMemo(
    () => buildSlices(consolidate(categories)),
    [categories]
  );

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Posts by category</CardTitle>
        <CardDescription>Published posts only.</CardDescription>
      </CardHeader>
      <CardContent className="my-auto p-0">
        {pieData.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">
            No published posts in a category yet.
          </p>
        ) : (
          <ChartContainer className="aspect-auto h-72 w-full" config={chartConfig}>
            <PieChart accessibilityLayer>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie
                cornerRadius={4}
                data={pieData}
                dataKey="posts"
                innerRadius={50}
                nameKey="key"
                outerRadius="88%"
                stroke="var(--card)"
                strokeWidth={4}
              >
                <LabelList
                  className="fill-background font-medium"
                  dataKey="posts"
                  fill="currentColor"
                  fontWeight={500}
                  position="inside"
                  stroke="none"
                />
              </Pie>
              <ChartLegend
                content={<ChartLegendContent className="flex flex-wrap gap-3 pt-2" nameKey="key" />}
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

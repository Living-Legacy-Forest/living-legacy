import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, formatInteger } from '@/lib/format';
import type { DashboardData } from '@/server/dashboard';
import { Delta, DeltaIcon, DeltaValue } from './delta';

type Stat = {
  label: string;
  value: number;
  /** Percent change; omitted when there is nothing to compare against. */
  delta?: number;
  hint: string;
};

function buildStats({ posts, media, publishedFaqs }: DashboardData): Stat[] {
  const { publishedLast30: last, publishedPrior30: prior } = posts;
  return [
    {
      label: 'Published posts',
      value: posts.published,
      ...(prior > 0
        ? { delta: ((last - prior) / prior) * 100, hint: 'published vs prior 30 days' }
        : { hint: `${formatInteger(last)} in the last 30 days` }),
    },
    { label: 'Drafts', value: posts.drafts, hint: 'Waiting to be published' },
    { label: 'Media files', value: media.files, hint: `${formatBytes(media.bytes)} stored` },
    { label: 'Published FAQs', value: publishedFaqs, hint: 'Shown on the FAQ page' },
  ];
}

export function DashboardStats({ data }: { data: DashboardData }) {
  return (
    <>
      {buildStats(data).map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const { label, value, delta, hint } = stat;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-balance tabular-nums">
          {formatInteger(value)}
        </p>
      </CardContent>
      <CardFooter className="mt-auto gap-1.5 text-xs">
        {delta !== undefined && (
          <Delta value={delta} variant="default">
            <DeltaIcon />
            <DeltaValue precision={0} />
          </Delta>
        )}
        <span className="text-muted-foreground text-pretty">{hint}</span>
      </CardFooter>
    </Card>
  );
}

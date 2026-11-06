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

/** "2 live, 1 coming soon": the stages that matter for visitors, as a short line. */
function locationHint(locations: DashboardData['locations']) {
  if (locations.length === 0) return 'None added yet';
  const live = locations.filter((l) => l.stage !== 'coming_soon').length;
  const soon = locations.length - live;
  return [live > 0 && `${live} open`, soon > 0 && `${soon} coming soon`].filter(Boolean).join(', ');
}

function buildStats({ posts, media, locations }: DashboardData): Stat[] {
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
    {
      label: 'Media files',
      value: media.files,
      hint:
        media.missingAlt > 0
          ? `${formatInteger(media.missingAlt)} ${media.missingAlt === 1 ? 'needs' : 'need'} alt text`
          : `${formatBytes(media.bytes)} stored`,
    },
    { label: 'Locations', value: locations.length, hint: locationHint(locations) },
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

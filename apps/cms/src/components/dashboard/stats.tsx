import { MUTED, type Stat, StatCard } from '@/components/stat-card/stat-card';
import { formatBytes, formatInteger } from '@/lib/format';
import type { DashboardData } from '@/server/dashboard';

/** "2 open to visitors, 1 coming soon": the stages that matter for visitors, as a short line. */
function locationHint(locations: DashboardData['locations']) {
  if (locations.length === 0) return 'None added yet';
  const live = locations.filter((l) => l.stage !== 'coming_soon').length;
  const soon = locations.length - live;
  return [live > 0 && `${live} open to visitors`, soon > 0 && `${soon} coming soon`]
    .filter(Boolean)
    .join(', ');
}

function buildStats({ posts, media, locations }: DashboardData): Stat[] {
  const open = locations.filter((l) => l.stage !== 'coming_soon').length;
  return [
    {
      label: 'Published posts',
      value: posts.published,
      hint: `${formatInteger(posts.publishedLast30)} in the last 30 days`,
      trend: { kind: 'area', weeks: posts.publishedWeekly, counted: 'posts published' },
    },
    {
      label: 'Drafts',
      value: posts.drafts,
      hint: 'Not on the website yet',
      trend: { kind: 'bar', weeks: posts.startedWeekly, counted: 'posts started' },
    },
    {
      label: 'Media files',
      value: media.files,
      hint:
        media.missingAlt > 0
          ? `${formatInteger(media.missingAlt)} ${media.missingAlt === 1 ? 'needs' : 'need'} alt text`
          : `${formatBytes(media.bytes)} stored`,
      trend: {
        kind: 'line',
        weeks: media.uploadedWeekly,
        counted: 'files uploaded',
        total: { value: media.files, label: 'files in the library' },
      },
    },
    {
      label: 'Locations',
      value: locations.length,
      hint: locationHint(locations),
      parts: [
        { key: 'open', label: 'Open', value: open, color: 'var(--primary)' },
        { key: 'soon', label: 'Coming soon', value: locations.length - open, color: MUTED },
      ],
    },
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

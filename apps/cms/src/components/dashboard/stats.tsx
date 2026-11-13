import { MUTED, type Stat, StatCard } from '@/components/stat-card/stat-card';
import { formatBytes, formatDate, formatInteger } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
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

const plural = (n: number, one: string, many: string) =>
  `${formatInteger(n)} ${n === 1 ? one : many}`;

function buildStats(
  { posts, events, media, locations, trendEndsAt: endsAt, trendMonths }: DashboardData,
  timeZone: string
): Stat[] {
  const open = locations.filter((l) => l.stage !== 'coming_soon').length;
  return [
    {
      // Published and drafts in one: what is live, and what is on its way.
      label: 'Posts',
      value: posts.published,
      hint:
        posts.drafts > 0
          ? `Published, plus ${plural(posts.drafts, 'draft', 'drafts')} in progress`
          : 'Published, with no drafts in progress',
      trend: {
        kind: 'area',
        weeks: posts.publishedWeekly,
        counted: 'posts published',
        compare: { weeks: posts.startedWeekly, counted: 'posts started' },
        endsAt,
        months: {
          keys: trendMonths,
          counts: posts.publishedMonthly,
          compare: posts.startedMonthly,
        },
      },
      link: { to: '/posts' },
    },
    {
      label: 'Events',
      value: events.upcoming,
      hint: events.next
        ? `Next: ${events.next.title}, ${formatDate(events.next.startsAt, timeZone)}`
        : 'Nothing coming up',
      trend: {
        kind: 'bar',
        weeks: events.bookedWeekly,
        counted: 'people booked',
        endsAt,
        months: { keys: trendMonths, counts: events.bookedMonthly },
      },
      // The overview is for people who run events.
      link: events.canManage ? { to: '/events/overview' } : undefined,
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
        endsAt,
        months: { keys: trendMonths, counts: media.uploadedMonthly },
      },
      link: { to: '/media' },
    },
    {
      label: 'Locations',
      value: locations.length,
      hint: locationHint(locations),
      parts: [
        { key: 'open', label: 'Open', value: open, color: 'var(--primary)' },
        { key: 'soon', label: 'Coming soon', value: locations.length - open, color: MUTED },
      ],
      link: { to: '/locations' },
    },
  ];
}

export function DashboardStats({ data }: { data: DashboardData }) {
  const timeZone = useTimeZone();
  return (
    <>
      {buildStats(data, timeZone).map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </>
  );
}

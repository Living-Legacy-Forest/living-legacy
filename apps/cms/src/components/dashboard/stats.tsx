import { MUTED, type Stat, StatCard } from '@/components/stat-card/stat-card';
import { formatBytes, formatDate, formatInteger } from '@/lib/format';
import { libraryMeter } from '@/lib/storage-meter';
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
  { posts, events, media, locations, trendDays, blogViews }: DashboardData,
  timeZone: string
): Stat[] {
  const open = locations.filter((l) => l.stage !== 'coming_soon').length;
  // With analytics, the Posts card is about readers: views of the blog's pages, with the
  // readers behind them. Without them it counts the posts themselves, as before.
  const posting: Stat = blogViews
    ? {
        label: 'Blog views',
        value: 0,
        hint: `Across ${plural(posts.published, 'published post', 'published posts')}${
          posts.drafts > 0 ? `, plus ${plural(posts.drafts, 'draft', 'drafts')} in progress` : ''
        }`,
        trend: {
          kind: 'area',
          counted: 'blog page views',
          compare: { counted: 'blog readers' },
          // The figure is the views in the span chosen.
          days: {
            keys: trendDays,
            counts: blogViews.days,
            compare: blogViews.readers,
            headline: true,
          },
        },
        link: { to: '/posts' },
      }
    : {
        // Published and drafts in one: what is live, and what is on its way.
        label: 'Posts',
        value: posts.published,
        hint:
          posts.drafts > 0
            ? `Published, plus ${plural(posts.drafts, 'draft', 'drafts')} in progress`
            : 'Published, with no drafts in progress',
        trend: {
          kind: 'area',
          counted: 'posts published',
          compare: { counted: 'posts started' },
          days: { keys: trendDays, counts: posts.publishedDaily, compare: posts.startedDaily },
        },
        link: { to: '/posts' },
      };
  return [
    posting,
    {
      label: 'Events',
      value: events.upcoming,
      hint: events.next
        ? `Next: ${events.next.title}, ${formatDate(events.next.startsAt, timeZone)}`
        : 'Nothing coming up',
      trend: {
        kind: 'bar',
        counted: 'people booked',
        days: { keys: trendDays, counts: events.bookedDaily },
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
      meter: libraryMeter(media.kinds, media.allowanceBytes),
      growth: media.growth,
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

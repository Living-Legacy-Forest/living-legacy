import { australianStateLabels, australianStates } from '@ll/content';
import { useEffect, useState } from 'react';
import { type Stat, StatCard } from '@/components/stat-card/stat-card';
import { formatBytes, formatDate, formatInteger } from '@/lib/format';
import { libraryMeter } from '@/lib/storage-meter';
import { useTimeZone } from '@/lib/use-time-zone';
import { getBlogViews } from '@/server/blog-views';
import type { DashboardData } from '@/server/dashboard';
import type { BlogViews } from '@/server/dashboard-trend-store';

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

/**
 * The blog's views once PostHog has answered. `'loading'` while it has not; `'off'` when
 * analytics are not connected; `'failed'` when it could not be reached.
 */
type Blog = BlogViews | 'loading' | 'off' | 'failed';

function useBlogViews(analytics: boolean): Blog {
  const [blog, setBlog] = useState<Blog>(analytics ? 'loading' : 'off');
  useEffect(() => {
    if (!analytics) return;
    let live = true;
    getBlogViews()
      .then((views) => live && setBlog(views ?? 'failed'))
      .catch(() => live && setBlog('failed'));
    return () => {
      live = false;
    };
  }, [analytics]);
  return blog;
}

function buildStats(
  { posts, events, media, locations, trendDays }: DashboardData,
  timeZone: string,
  blog: Blog
): Stat[] {
  // Locations per state, the biggest first: the ring shows where the forests are, not how ready
  // they are (the line above the figure already says that).
  const byState = australianStates
    .map((state) => ({
      key: state,
      label: australianStateLabels[state],
      value: locations.filter((l) => l.state === state).length,
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  // The card keeps its shape whatever PostHog is doing: flat at zero while it answers, and a
  // line saying why when it has nothing to show.
  const views = typeof blog === 'object' ? blog : null;
  const posting: Stat = {
    label: 'Blog views',
    value: 0,
    // A dash, not a zero, when there is no count to wait for.
    display: blog === 'off' || blog === 'failed' ? '–' : undefined,
    hint: views
      ? `Across ${plural(posts.published, 'published post', 'published posts')}${
          posts.drafts > 0 ? `, plus ${plural(posts.drafts, 'draft', 'drafts')} in progress` : ''
        }`
      : blog === 'off'
        ? 'Website analytics are not connected'
        : blog === 'failed'
          ? 'Could not load the views. Try again soon'
          : 'Counting views…',
    trend: {
      kind: 'area',
      counted: 'blog page views',
      compare: { counted: 'blog readers' },
      // The figure is the views in the span chosen.
      days: {
        keys: trendDays,
        counts: views?.days ?? trendDays.map(() => 0),
        compare: views?.readers ?? trendDays.map(() => 0),
        headline: true,
      },
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
        none: 'No bookings',
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
      parts: byState,
      link: { to: '/locations' },
    },
  ];
}

export function DashboardStats({ data }: { data: DashboardData }) {
  const timeZone = useTimeZone();
  const blog = useBlogViews(data.analytics);
  return (
    <>
      {buildStats(data, timeZone, blog).map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </>
  );
}

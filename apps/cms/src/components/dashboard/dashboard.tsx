import type { SessionUser } from '@/lib/session';
import type { DashboardData } from '@/server/dashboard';
import { CategoryChart } from './category-chart';
import { PublishingChart } from './publishing-chart';
import { QuickActions } from './quick-actions';
import { RecentPosts } from './recent-posts';
import { DashboardStats } from './stats';

export function Dashboard({ data, user }: { data: DashboardData; user: SessionUser }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <DashboardStats data={data} />
      <PublishingChart activity={data.activity} />
      <CategoryChart categories={data.categories} />
      <RecentPosts drafts={data.recentDrafts} published={data.recentlyPublished} />
      <QuickActions user={user} />
    </div>
  );
}
